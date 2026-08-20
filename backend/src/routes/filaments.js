import { Router } from 'express';
import { getDb, rowId, transaction } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const FILAMENT_SELECT = `
  SELECT f.*, b.name as brand_name,
    (SELECT COUNT(*) FROM spools WHERE filament_id = f.id AND is_active = 1) as spool_count,
    (SELECT SUM(remaining_weight) FROM spools WHERE filament_id = f.id AND is_active = 1) as total_remaining,
    (SELECT AVG(purchase_price) FROM spools WHERE filament_id = f.id AND is_active = 1 AND purchase_price IS NOT NULL) as avg_price
  FROM filaments f
  LEFT JOIN brands b ON f.brand_id = b.id
`;

const CSV_HEADERS = [
  'name', 'brand', 'material', 'color_hex', 'color_name', 'finish',
  'density_g_cm3', 'price_per_kg_dkk', 'spool_weight_g', 'low_stock_threshold_g',
  'nozzle_temp_c', 'bed_temp_c', 'location', 'notes', 'initial_spools', 'initial_weight_g', 'spool_type',
];

function escapeCSV(v) {
  const s = String(v ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowToCSV(cols) {
  return cols.map(escapeCSV).join(',');
}

function parseCSVRow(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
}

// ── Export (one row per active spool — preserves individual remaining weights) ─
router.get('/export', requireAuth, (req, res) => {
  const rows = getDb().prepare(`
    SELECT f.*, b.name as brand_name,
      s.remaining_weight as spool_remaining, s.spool_type as spool_kind, s.purchase_price as spool_price
    FROM spools s
    JOIN filaments f ON s.filament_id = f.id
    LEFT JOIN brands b ON f.brand_id = b.id
    WHERE s.is_active = 1
    ORDER BY f.name ASC, s.created_at ASC
  `).all();
  const lines = [
    rowToCSV(CSV_HEADERS),
    ...rows.map(r => rowToCSV([
      r.name,
      r.brand_name ?? '',
      r.material,
      r.color_hex,
      r.color_name ?? '',
      r.finish ?? '',
      r.density,
      r.price_per_kg,
      r.spool_weight,
      r.low_stock_threshold,
      r.nozzle_temp,
      r.bed_temp,
      r.location ?? '',
      r.notes ?? '',
      1,
      r.spool_remaining,
      r.spool_kind,
    ])),
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="filaments.csv"');
  res.send(lines.join('\n'));
});

// ── Import ────────────────────────────────────────────────────────────────────
router.post('/import', requireAuth, (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv field required' });

  const rows = parseCSV(csv);
  if (!rows.length) return res.status(400).json({ error: 'No data rows found' });

  const db = getDb();
  const getBrand     = db.prepare('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)');
  const insertBrand  = db.prepare('INSERT OR IGNORE INTO brands (name) VALUES (?)');
  const findFilament = db.prepare(`
    SELECT f.id FROM filaments f
    LEFT JOIN brands b ON f.brand_id = b.id
    WHERE LOWER(f.name) = LOWER(?) AND LOWER(f.material) = LOWER(?)
      AND LOWER(COALESCE(b.name,'')) = LOWER(COALESCE(?,''))
  `);
  const insertFilament = db.prepare(`
    INSERT INTO filaments (name, brand_id, material, color_hex, color_name, finish,
      density, price_per_kg, spool_weight, low_stock_threshold, nozzle_temp, bed_temp, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSpool = db.prepare(`
    INSERT INTO spools (filament_id, remaining_weight, spool_type, purchase_price)
    VALUES (?, ?, ?, ?)
  `);

  const VALID_TYPES = ['non-reusable', 'reusable', 'refill'];
  let filamentsCreated = 0, spoolsAdded = 0, skipped = 0;
  const errors = [];

  transaction(() => {
    for (const row of rows) {
      const name = row.name?.trim();
      if (!name) { skipped++; continue; }

      try {
        const brandName = row.brand?.trim() || '';
        let brandId = null;
        if (brandName) {
          insertBrand.run(brandName);
          brandId = getBrand.get(brandName)?.id ?? null;
        }

        const material    = row.material?.trim() || 'PLA';
        const spoolWeightDef = parseInt(row.spool_weight_g) || 1000;
        const pricePerKg  = parseFloat(row.price_per_kg_dkk) || null;

        // Upsert: add spools to existing filament if name+brand+material match
        let filamentId;
        const existing = findFilament.get(name, material, brandName);
        if (existing) {
          filamentId = existing.id;
        } else {
          filamentId = rowId(insertFilament.run(
            name, brandId, material,
            row.color_hex?.trim() || '#ffffff',
            row.color_name?.trim() || null,
            row.finish?.trim() || null,
            parseFloat(row.density_g_cm3) || 1.24,
            pricePerKg ?? 149,
            spoolWeightDef,
            parseInt(row.low_stock_threshold_g) || 150,
            parseInt(row.nozzle_temp_c) || 220,
            parseInt(row.bed_temp_c) || 65,
            row.location?.trim() || '',
            row.notes?.trim() || null,
          ));
          filamentsCreated++;
        }

        const spoolCount  = parseInt(row.initial_spools) || 0;
        const spoolWeight = parseFloat(row.initial_weight_g) || spoolWeightDef;
        const spoolType   = VALID_TYPES.includes(row.spool_type?.trim()) ? row.spool_type.trim() : 'non-reusable';
        // Per-spool purchase cost = price/kg × full-spool weight
        const spoolPrice  = pricePerKg ? Math.round(pricePerKg * spoolWeightDef / 1000 * 100) / 100 : null;

        for (let i = 0; i < spoolCount; i++) {
          insertSpool.run(filamentId, spoolWeight, spoolType, spoolPrice);
          spoolsAdded++;
        }
      } catch (err) {
        errors.push(`Row "${name}": ${err.message}`);
        skipped++;
      }
    }
  });

  res.json({ filaments: filamentsCreated, spools: spoolsAdded, skipped, errors });
});

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  res.json(getDb().prepare(FILAMENT_SELECT + ' ORDER BY f.created_at DESC').all());
});

router.get('/:id', requireAuth, (req, res) => {
  const row = getDb().prepare(FILAMENT_SELECT + ' WHERE f.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', requireAuth, (req, res) => {
  const {
    name, brand_id, material = 'PLA', color_hex = '#ffffff', color_name,
    finish = 'Basic', density = 1.24, price_per_kg = 149,
    spool_weight = 1000, low_stock_threshold = 150,
    nozzle_temp = 220, bed_temp = 65, location = '', notes
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = rowId(getDb().prepare(`
    INSERT INTO filaments (name, brand_id, material, color_hex, color_name, finish, density,
      price_per_kg, spool_weight, low_stock_threshold, nozzle_temp, bed_temp, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, brand_id || null, material, color_hex, color_name || null, finish,
    density, price_per_kg, spool_weight, low_stock_threshold, nozzle_temp, bed_temp, location, notes || null));

  res.status(201).json({ id });
});

router.put('/:id', requireAuth, (req, res) => {
  const {
    name, brand_id, material, color_hex, color_name, finish, density,
    price_per_kg, spool_weight, low_stock_threshold, nozzle_temp, bed_temp, location, notes
  } = req.body;
  getDb().prepare(`
    UPDATE filaments SET name=?, brand_id=?, material=?, color_hex=?, color_name=?, finish=?,
      density=?, price_per_kg=?, spool_weight=?, low_stock_threshold=?, nozzle_temp=?, bed_temp=?,
      location=?, notes=? WHERE id=?
  `).run(name, brand_id || null, material, color_hex, color_name || null, finish,
    density, price_per_kg, spool_weight, low_stock_threshold, nozzle_temp, bed_temp,
    location, notes || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/all', requireAdmin, (req, res) => {
  const db = getDb();
  db.exec('DELETE FROM ams_slots');
  db.exec('DELETE FROM spools');
  db.exec('DELETE FROM filaments');
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM filaments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;

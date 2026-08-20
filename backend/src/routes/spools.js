import { Router } from 'express';
import { getDb, rowId } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const SPOOL_SELECT = `
  SELECT s.*, f.name as filament_name, f.material, f.color_hex, f.spool_weight,
    b.name as brand_name, rs.name as reusable_spool_name
  FROM spools s
  JOIN filaments f ON s.filament_id = f.id
  LEFT JOIN brands b ON f.brand_id = b.id
  LEFT JOIN reusable_spools rs ON s.reusable_spool_id = rs.id
`;

router.get('/reusable', requireAuth, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM reusable_spools ORDER BY created_at DESC').all());
});

router.get('/', requireAuth, (req, res) => {
  const { filament_id } = req.query;
  let sql = SPOOL_SELECT;
  const params = [];
  if (filament_id) { sql += ' WHERE s.filament_id = ?'; params.push(filament_id); }
  sql += ' ORDER BY s.created_at ASC';
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/:id', requireAuth, (req, res) => {
  const row = getDb().prepare(SPOOL_SELECT + ' WHERE s.id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', requireAuth, (req, res) => {
  const {
    filament_id, remaining_weight, spool_type = 'non-reusable',
    purchase_price, location, tag_uid, notes
  } = req.body;
  if (!filament_id) return res.status(400).json({ error: 'filament_id required' });

  const db = getDb();
  const filament = db.prepare('SELECT spool_weight FROM filaments WHERE id = ?').get(filament_id);
  if (!filament) return res.status(404).json({ error: 'Filament not found' });

  const weight = remaining_weight ?? filament.spool_weight;

  const id = rowId(db.prepare(`
    INSERT INTO spools (filament_id, remaining_weight, spool_type, purchase_price, location, tag_uid, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(filament_id, weight, spool_type, purchase_price || null, location || null, tag_uid || null, notes || null));

  res.status(201).json({ id });
});

router.put('/:id', requireAuth, (req, res) => {
  const { remaining_weight, spool_type, purchase_price, location, tag_uid, notes, is_active } = req.body;
  const db = getDb();
  const spool = db.prepare('SELECT * FROM spools WHERE id = ?').get(req.params.id);
  if (!spool) return res.status(404).json({ error: 'Not found' });

  // reusable_spool_id may be explicitly set to null (unload), so check key presence
  const reusable_spool_id = 'reusable_spool_id' in req.body
    ? req.body.reusable_spool_id
    : spool.reusable_spool_id;

  db.prepare(`
    UPDATE spools SET remaining_weight=?, spool_type=?, purchase_price=?, location=?,
      tag_uid=?, notes=?, is_active=?, reusable_spool_id=? WHERE id=?
  `).run(
    remaining_weight ?? spool.remaining_weight,
    spool_type ?? spool.spool_type,
    purchase_price ?? spool.purchase_price,
    location ?? spool.location,
    tag_uid ?? spool.tag_uid,
    notes ?? spool.notes,
    is_active ?? spool.is_active,
    reusable_spool_id,
    req.params.id
  );
  res.json({ ok: true });
});

router.post('/:id/use', requireAuth, (req, res) => {
  const { grams } = req.body;
  if (!grams || grams <= 0) return res.status(400).json({ error: 'grams > 0 required' });

  const db = getDb();
  const spool = db.prepare('SELECT * FROM spools WHERE id = ?').get(req.params.id);
  if (!spool) return res.status(404).json({ error: 'Not found' });

  const newWeight = Math.max(0, spool.remaining_weight - grams);
  db.prepare('UPDATE spools SET remaining_weight = ? WHERE id = ?').run(newWeight, req.params.id);
  res.json({ remaining_weight: newWeight });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM spools WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/reusable', requireAuth, (req, res) => {
  const { name, weight = 165, notes } = req.body;
  const id = rowId(getDb()
    .prepare('INSERT INTO reusable_spools (name, weight, notes) VALUES (?, ?, ?)')
    .run(name || null, weight, notes || null));
  res.status(201).json({ id });
});

router.delete('/reusable/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM reusable_spools WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;

// Public, unauthenticated read-only API for the webstore: which colours can we
// print in right now. Deliberately exposes only cosmetic fields — no prices,
// stock locations, notes or printer details.
import { Router } from 'express';
import cors from 'cors';
import { getDb } from '../db/index.js';
import { getPrinterStatus } from '../services/mqttService.js';

const router = Router();

// Open CORS: this is meant to be fetched from the webstore's own origin(s), and
// carries no credentials. Mounted before the app's credentialed CORS layer.
router.use(cors({ origin: '*', credentials: false }));

// 'Basic' is the default in the UI, not a real modifier — normalise it away.
function modifierOf(finish) {
  const f = (finish ?? '').trim();
  if (!f || f.toLowerCase() === 'basic') return null;
  return f;
}

const COLORS_SELECT = `
  SELECT
    f.id,
    f.name                                  AS full_name,
    COALESCE(NULLIF(TRIM(f.color_name), ''), f.name) AS name,
    UPPER(f.color_hex)                      AS color_hex,
    f.material                              AS material,
    f.finish                                AS finish,
    b.name                                  AS brand,
    f.low_stock_threshold                   AS low_stock_threshold,
    COALESCE((SELECT SUM(remaining_weight) FROM spools
              WHERE filament_id = f.id AND is_active = 1), 0) AS remaining_g
  FROM filaments f
  LEFT JOIN brands b ON f.brand_id = b.id
`;

// GET /api/public/colors
//   ?include_out_of_stock=1   also return colours with no filament left
//   ?material=PLA             filter by material (case-insensitive)
router.get('/colors', (req, res) => {
  const includeOut = ['1', 'true', 'yes'].includes(String(req.query.include_out_of_stock).toLowerCase());
  const material = req.query.material?.trim();

  const where = [];
  const params = [];
  if (!includeOut) where.push('remaining_g > 0');
  if (material) { where.push('LOWER(material) = LOWER(?)'); params.push(material); }

  const sql = `SELECT * FROM (${COLORS_SELECT}) ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY material ASC, name ASC`;

  const colors = getDb().prepare(sql).all(...params).map(r => ({
    id: r.id,
    name: r.name,
    color_hex: r.color_hex,
    material: r.material,
    modifier: modifierOf(r.finish),
    brand: r.brand ?? null,
    full_name: r.full_name,
    in_stock: r.remaining_g > 0,
    low_stock: r.remaining_g > 0 && r.remaining_g <= r.low_stock_threshold,
  }));

  // Cheap caching for a store front page; stock changes are not urgent here.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ count: colors.length, colors });
});

// ── Public print progress ─────────────────────────────────────────────────────
// Powers the standalone /live page. Reads only the in-memory MQTT status map —
// it never touches the database, so there is no path from here to filaments,
// prices, locations, print history or printer credentials.
//
// Deliberately NOT exposed: the gcode filename (job and customer names leak
// through it), the serial number and IP (half of what you need to take the
// printer over), the access code, the internal printer id, and the raw MQTT
// payload the /ws debug feed carries.
const PUBLIC_STATES = {
  RUNNING: 'printing',
  PAUSE: 'paused',
  FINISH: 'finished',
  FAILED: 'failed',
  IDLE: 'idle',
  PREPARE: 'preparing',
  SLICING: 'preparing',
};

function publicState(live) {
  if (!live?.connected) return 'offline';
  return PUBLIC_STATES[String(live.gcode_state || '').toUpperCase()] || 'idle';
}

function round1(n) {
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function intOrNull(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : null;
}

// GET /api/public/print-status
//
// The printer list comes from the DB (names only) rather than from the live MQTT
// map, so a printer that is powered off still shows up as "offline" instead of
// silently disappearing — liveStatus only gains an entry once a printer has
// connected at least once since the service started.
router.get('/print-status', (req, res) => {
  const rows = getDb()
    .prepare('SELECT name, serial_number FROM printers WHERE is_active = 1')
    .all();

  const printers = rows
    .map((row, i) => {
      const live = getPrinterStatus(row.serial_number) || {};
      const state = publicState(live);
      const printing = state === 'printing' || state === 'paused';
      return {
        // Positional id only — stable enough for the page to key on, and it
        // reveals nothing about the printer itself. The serial stays server-side.
        id: i,
        name: row.name || `Printer ${i + 1}`,
        state,
        percent: printing ? intOrNull(live.mc_percent) : null,
        layer: printing ? intOrNull(live.layer_num) : null,
        total_layers: printing ? intOrNull(live.total_layer_num) : null,
        remaining_min: printing ? intOrNull(live.mc_remaining_time) : null,
        nozzle_temp: round1(live.nozzle_temper),
        bed_temp: round1(live.bed_temper),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Live data — never let a proxy or browser serve a stale percentage.
  res.setHeader('Cache-Control', 'no-store');
  res.json({ printers, server_time: Date.now() });
});

export default router;

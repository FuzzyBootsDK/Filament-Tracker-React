// Public, unauthenticated read-only print progress for the standalone /live
// page. Kept on its own /api/live prefix, separate from /api/public, so a
// reverse proxy can expose print progress to the internet without also exposing
// the webstore colour/stock API that shares the "public" label.
//
// Deliberately NOT exposed: the gcode filename (job and customer names leak
// through it), the serial number and IP (half of what you need to take the
// printer over), the access code, the internal printer id, and the raw MQTT
// payload the /ws debug feed carries.
import { Router } from 'express';
import cors from 'cors';
import { getDb } from '../db/index.js';
import { getPrinterStatus } from '../services/mqttService.js';

const router = Router();

// Open CORS, no credentials — so the page can also be embedded elsewhere.
// Mounted before the app's credentialed CORS layer.
router.use(cors({ origin: '*', credentials: false }));

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

// GET /api/live/status
//
// The printer list comes from the DB (names only) rather than from the live MQTT
// map, so a printer that is powered off still shows up as "offline" instead of
// silently disappearing — liveStatus only gains an entry once a printer has
// connected at least once since the service started.
router.get('/status', (req, res) => {
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

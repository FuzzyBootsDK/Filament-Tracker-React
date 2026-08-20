import { Router } from 'express';
import { getDb, rowId } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const { limit = 100, offset = 0, printer_id } = req.query;
  let sql = `
    SELECT pj.*, p.name as printer_display_name
    FROM print_jobs pj LEFT JOIN printers p ON pj.printer_id = p.id
  `;
  const params = [];
  if (printer_id) { sql += ' WHERE pj.printer_id = ?'; params.push(printer_id); }
  sql += ' ORDER BY pj.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  res.json(getDb().prepare(sql).all(...params));
});

router.get('/stats', requireAuth, (req, res) => {
  const stats = getDb().prepare(`
    SELECT
      COUNT(*) as total_jobs,
      ROUND(SUM(filament_used_g), 1) as total_filament_g,
      ROUND(SUM(duration_minutes) / 60.0, 1) as total_hours,
      COUNT(DISTINCT printer_id) as printers_used
    FROM print_jobs
  `).get();
  res.json(stats);
});

router.get('/:id', requireAuth, (req, res) => {
  const row = getDb().prepare(`
    SELECT pj.*, p.name as printer_display_name
    FROM print_jobs pj LEFT JOIN printers p ON pj.printer_id = p.id
    WHERE pj.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', requireAuth, (req, res) => {
  const {
    printer_id, printer_name, file_name, started_at, ended_at,
    status = 'completed', filament_used_g, layer_count, total_layers,
    duration_minutes, spool_id, notes
  } = req.body;

  const id = rowId(getDb().prepare(`
    INSERT INTO print_jobs (printer_id, printer_name, file_name, started_at, ended_at,
      status, filament_used_g, layer_count, total_layers, duration_minutes, spool_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    printer_id || null, printer_name || null, file_name || null,
    started_at || null, ended_at || null, status,
    filament_used_g || null, layer_count || null, total_layers || null,
    duration_minutes || null, spool_id || null, notes || null
  ));

  res.status(201).json({ id });
});

router.put('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { ended_at, status, filament_used_g, notes } = req.body;
  db.prepare(`
    UPDATE print_jobs SET
      ended_at = COALESCE(?, ended_at),
      status = COALESCE(?, status),
      filament_used_g = COALESCE(?, filament_used_g),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(ended_at ?? null, status ?? null, filament_used_g ?? null, notes ?? null, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM print_jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;

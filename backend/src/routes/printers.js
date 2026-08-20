import { Router } from 'express';
import { getDb, rowId } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { connectPrinter, disconnectPrinter, getPrinterStatus } from '../services/mqttService.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const printers = getDb().prepare('SELECT * FROM printers ORDER BY created_at DESC').all();
  res.json(printers.map(p => ({ ...p, live: getPrinterStatus(p.serial_number) || null })));
});

router.get('/:id', requireAuth, (req, res) => {
  const p = getDb().prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ ...p, live: getPrinterStatus(p.serial_number) || null });
});

router.post('/', requireAdmin, (req, res) => {
  const { name, model, ip_address, access_code, serial_number, notes } = req.body;
  if (!name || !ip_address || !access_code || !serial_number)
    return res.status(400).json({ error: 'name, ip_address, access_code, serial_number required' });
  try {
    const id = rowId(getDb().prepare(`
      INSERT INTO printers (name, model, ip_address, access_code, serial_number, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, model || null, ip_address, access_code, serial_number, notes || null));

    connectPrinter({ id, name, ip_address, access_code, serial_number });
    res.status(201).json({ id });
  } catch {
    res.status(409).json({ error: 'Serial number already exists' });
  }
});

router.put('/:id', requireAdmin, (req, res) => {
  const { name, model, ip_address, access_code, serial_number, is_active, notes } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE printers SET name=?, model=?, ip_address=?, access_code=?, serial_number=?,
      is_active=?, notes=? WHERE id=?
  `).run(
    name ?? existing.name, model ?? existing.model,
    ip_address ?? existing.ip_address, access_code ?? existing.access_code,
    serial_number ?? existing.serial_number,
    is_active ?? existing.is_active, notes ?? existing.notes,
    req.params.id
  );

  disconnectPrinter(existing.serial_number);
  const updated = db.prepare('SELECT * FROM printers WHERE id = ?').get(req.params.id);
  if (updated.is_active) connectPrinter(updated);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const p = getDb().prepare('SELECT serial_number FROM printers WHERE id = ?').get(req.params.id);
  if (p) disconnectPrinter(p.serial_number);
  getDb().prepare('DELETE FROM printers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;

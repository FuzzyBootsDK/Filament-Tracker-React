import { Router } from 'express';
import { getDb, rowId } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json(getDb().prepare('SELECT * FROM brands ORDER BY name').all());
});

router.post('/', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  try {
    const id = rowId(getDb()
      .prepare('INSERT INTO brands (name) VALUES (?)')
      .run(name.trim()));
    res.status(201).json({ id, name: name.trim() });
  } catch {
    res.status(409).json({ error: 'Brand already exists' });
  }
});

router.delete('/:id', requireAdmin, (req, res) => {
  getDb().prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/:id', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  getDb().prepare('UPDATE brands SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json({ ok: true });
});

export default router;

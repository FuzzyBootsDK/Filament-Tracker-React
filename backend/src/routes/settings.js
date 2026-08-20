import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM app_settings').all();
  const settings = {};
  for (const { key, value } of rows) settings[key] = value;
  res.json(settings);
});

router.put('/', requireAdmin, (req, res) => {
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const tx = db.transaction((updates) => {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) upsert.run(key, String(value));
    }
  });
  tx(req.body);
  res.json({ ok: true });
});

export default router;

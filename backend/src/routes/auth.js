import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, rowId } from '../db/index.js';
import { requireAuth, requireAdmin, signToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ id: user.id, username: user.username, is_admin: user.is_admin });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ id: user.id, username: user.username, is_admin: user.is_admin });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.get('/users', requireAdmin, (req, res) => {
  const users = getDb().prepare('SELECT id, username, is_admin, created_at FROM users ORDER BY id').all();
  res.json(users);
});

router.post('/users', requireAdmin, (req, res) => {
  const { username, password, is_admin = 0 } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const id = rowId(getDb()
      .prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)')
      .run(username, hash, is_admin ? 1 : 0));
    res.status(201).json({ id, username, is_admin: is_admin ? 1 : 0 });
  } catch {
    res.status(409).json({ error: 'Username already exists' });
  }
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  getDb().prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'password required' });
  const hash = bcrypt.hashSync(password, 10);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

router.post('/setup', (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return res.status(403).json({ error: 'Setup already completed' });
  const { username = 'admin', password = 'admin' } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  const id = rowId(db
    .prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)')
    .run(username, hash));
  res.status(201).json({ id, username, is_admin: 1 });
});

export default router;

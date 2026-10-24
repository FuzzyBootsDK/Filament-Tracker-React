import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'filament-tracker-secret-change-in-prod';

// Login can be switched off entirely for trusted-LAN deployments. When it is off,
// every request runs as this synthetic admin, so no route has to know the difference.
// Set AUTH_DISABLED=false to require login again.
export const AUTH_DISABLED = String(process.env.AUTH_DISABLED ?? 'true') !== 'false';

export const LOCAL_USER = { id: 0, username: 'local', is_admin: 1 };

export function requireAuth(req, res, next) {
  if (AUTH_DISABLED) {
    req.user = LOCAL_USER;
    return next();
  }
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin required' });
    next();
  });
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' });
}

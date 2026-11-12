import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

import { initDB } from './db/index.js';
import { setBroadcast, startMqttService } from './services/mqttService.js';
import { startRelay } from './services/mqttRelay.js';

import authRoutes from './routes/auth.js';
import filamentsRoutes from './routes/filaments.js';
import spoolsRoutes from './routes/spools.js';
import brandsRoutes from './routes/brands.js';
import printersRoutes from './routes/printers.js';
import amsRoutes from './routes/ams.js';
import printJobsRoutes from './routes/printJobs.js';
import settingsRoutes from './routes/settings.js';
import publicRoutes from './routes/public.js';
import { AUTH_DISABLED } from './middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
// The /ws feed carries the raw Bambu MQTT payloads (the Settings debug panel),
// so it is far more revealing than anything else the app serves. Reject browser
// handshakes from other origins, which stops any page the user happens to visit
// from opening this socket behind their back. Non-browser clients send no Origin
// and are left alone — reaching the port at all is the access control there, so
// keep /ws off the public side of any reverse proxy.
const WS_ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

function wsOriginAllowed({ origin, req }) {
  if (!origin) return true;
  if (origin === WS_ALLOWED_ORIGIN) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: (info) => {
    const ok = wsOriginAllowed({ origin: info.origin, req: info.req });
    if (!ok) console.warn(`Rejected /ws handshake from origin: ${info.origin}`);
    return ok;
  },
});

// WebSocket broadcast to all connected clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try { const d = JSON.parse(raw); if (d.type === 'ping') ws.send(JSON.stringify({ type: 'pong' })); } catch {}
  });
});

// Public webstore API: mounted before the credentialed CORS layer below so it
// can serve Access-Control-Allow-Origin: * without a conflicting credentials header.
app.use('/api/public', publicRoutes);

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/filaments', filamentsRoutes);
app.use('/api/spools', spoolsRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/printers', printersRoutes);
app.use('/api/ams', amsRoutes);
app.use('/api/print-jobs', printJobsRoutes);
app.use('/api/settings', settingsRoutes);

// Standalone public print-status page. Self-contained HTML with no tracker code
// in it — expose only this path and /api/public/* through a reverse proxy and
// nothing else in the app is reachable.
const LIVE_PAGE = join(__dirname, '../public-live/live.html');
app.get(['/live', '/live/'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(LIVE_PAGE);
});

// Serve built frontend in production
const PUBLIC = join(__dirname, '../../public');
if (process.env.NODE_ENV === 'production' && existsSync(PUBLIC)) {
  app.use(express.static(PUBLIC));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      res.sendFile(join(PUBLIC, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 3001;

initDB();
setBroadcast(broadcast);
startRelay();
startMqttService();

server.listen(PORT, () => {
  console.log(`Filament Tracker backend on http://0.0.0.0:${PORT}`);
  if (AUTH_DISABLED) {
    console.log('AUTH_DISABLED=true — no login required. Anyone who can reach this port');
    console.log('has full access, including stored printer access codes. Trusted LAN only.');
  } else if (!process.env.JWT_SECRET) {
    console.warn('WARNING: login is enabled but JWT_SECRET is not set — using the built-in');
    console.warn('fallback secret, which anyone can read from the source. Set JWT_SECRET.');
  }
});

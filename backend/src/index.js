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

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

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
});

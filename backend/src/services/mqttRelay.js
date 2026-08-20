import aedes from 'aedes';
import { createServer } from 'net';
import { getDb } from '../db/index.js';

let broker = null;
let server = null;

export function relayPublish(topic, payload) {
  if (!broker) return;
  broker.publish({ topic, payload: Buffer.from(payload), qos: 0, retain: false }, () => {});
}

export function startRelay() {
  try {
    const db = getDb();
    const enabled = db.prepare("SELECT value FROM app_settings WHERE key='relay_enabled'").get();
    const portRow = db.prepare("SELECT value FROM app_settings WHERE key='relay_port'").get();

    if (!enabled || enabled.value !== 'true') {
      console.log('MQTT relay disabled');
      return;
    }

    const port = Number(portRow?.value || 1883);
    broker = aedes();
    server = createServer(broker.handle);

    server.listen(port, () => {
      console.log(`MQTT relay broker running on TCP port ${port}`);
    });

    server.on('error', (err) => {
      console.warn('MQTT relay error:', err.message);
    });

    broker.on('client', (client) => {
      console.log(`Relay client connected: ${client.id}`);
    });
  } catch (err) {
    console.warn('MQTT relay start skipped:', err.message);
  }
}

export function stopRelay() {
  if (server) { server.close(); server = null; }
  if (broker) { broker.close(); broker = null; }
}

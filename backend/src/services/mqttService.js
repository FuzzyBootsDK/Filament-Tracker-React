import mqtt from 'mqtt';
import { getDb, rowId } from '../db/index.js';
import { syncAmsSlots } from './amsSync.js';
import { relayPublish } from './mqttRelay.js';

// Map of serialNumber → { client, status }
const connections = new Map();
// Map of serialNumber → latest live status
const liveStatus = new Map();
// Active print tracking for auto-logging: serialNumber → { jobId, startedAt, lastPercent }
const activePrints = new Map();

let broadcastFn = null;
export function setBroadcast(fn) { broadcastFn = fn; }

function broadcast(data) {
  if (broadcastFn) broadcastFn(data);
  relayPublish(`tracker/printer/${data.serial}`, JSON.stringify(data));
}

export function getPrinterStatus(serial) {
  return liveStatus.get(serial) || null;
}

export function connectPrinter(printer) {
  if (connections.has(printer.serial_number)) {
    disconnectPrinter(printer.serial_number);
  }

  const url = `mqtts://${printer.ip_address}:8883`;
  const client = mqtt.connect(url, {
    username: 'bblp',
    password: printer.access_code,
    rejectUnauthorized: false,
    connectTimeout: 10_000,
    reconnectPeriod: 15_000,
    clientId: `filament-tracker-${printer.serial_number}`,
  });

  const topic = `device/${printer.serial_number}/report`;

  client.on('connect', () => {
    console.log(`MQTT connected: ${printer.name} (${printer.serial_number})`);
    client.subscribe(topic);
    updateStatus(printer, { connected: true });
  });

  client.on('message', (t, payload) => {
    try {
      const msg = JSON.parse(payload.toString());
      if (broadcastFn) broadcastFn({
        type: 'mqtt_debug',
        serial: printer.serial_number,
        printer_name: printer.name,
        topic: t,
        ts: Date.now(),
        payload: msg,
      });
      handlePrinterMessage(printer, msg);
    } catch (err) {
      console.error('[MQTT handler error]', err.message, err.stack);
    }
  });

  client.on('error', (err) => {
    console.warn(`MQTT error [${printer.name}]:`, err.message);
  });

  client.on('offline', () => {
    updateStatus(printer, {
      connected: false,
      nozzle_temper: null, bed_temper: null, chamber_temper: null,
      gcode_state: null, mc_percent: null, layer_num: null,
      total_layer_num: null, mc_remaining_time: null,
      gcode_file: null, wifi_signal: null, speed_level: null,
    });
  });

  connections.set(printer.serial_number, client);
}

export function disconnectPrinter(serial) {
  const client = connections.get(serial);
  if (client) { client.end(true); connections.delete(serial); liveStatus.delete(serial); }
}

function updateStatus(printer, partial) {
  const current = liveStatus.get(printer.serial_number) || {};
  const next = { ...current, ...partial, serial: printer.serial_number, printer_id: printer.id, printer_name: printer.name };
  liveStatus.set(printer.serial_number, next);
  broadcast({ type: 'printer_status', ...next });
}

function handlePrinterMessage(printer, msg) {
  const p = msg?.print;
  if (!p) return;

  const raw = {
    connected: true,
    gcode_state: p.gcode_state,
    mc_percent: p.mc_percent,
    layer_num: p.layer_num,
    total_layer_num: p.total_layer_num,
    mc_remaining_time: p.mc_remaining_time,
    gcode_file: p.gcode_file,
    nozzle_temper: p.nozzle_temper,
    bed_temper: p.bed_temper,
    chamber_temper: p.chamber_temper,
    fan_gear: p.fan_gear,
    wifi_signal: p.wifi_signal,
    speed_level: p.spd_lvl,
  };
  // Only merge fields present in this message — undefined would overwrite prior values
  const status = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));

  updateStatus(printer, status);

  // AMS slot sync
  if (p.ams?.ams?.length) {
    syncAmsSlots(printer, p.ams.ams);
  }

  // Auto print-job logging
  trackPrintJob(printer, p);
}

function trackPrintJob(printer, p) {
  const db = getDb();
  const serial = printer.serial_number;
  const state = p.gcode_state;
  const active = activePrints.get(serial);

  if (!active && state === 'RUNNING') {
    // New print started
    const jobId = rowId(db.prepare(`
      INSERT INTO print_jobs (printer_id, printer_name, file_name, started_at, status, total_layers)
      VALUES (?, ?, ?, datetime('now'), 'running', ?)
    `).run(printer.id, printer.name, p.gcode_file || null, p.total_layer_num || null));
    activePrints.set(serial, { jobId, lastPercent: p.mc_percent });
    console.log(`Print job started: ${p.gcode_file} on ${printer.name} (job #${jobId})`);
  } else if (active) {
    if (state === 'FINISH' || state === 'FAILED' || state === 'STOPPED') {
      const status = state === 'FINISH' ? 'completed' : state === 'FAILED' ? 'failed' : 'cancelled';
      db.prepare(`
        UPDATE print_jobs SET ended_at=datetime('now'), status=?, layer_count=?,
          duration_minutes=ROUND((JULIANDAY('now')-JULIANDAY(started_at))*1440)
        WHERE id=?
      `).run(status, p.layer_num || null, active.jobId);
      activePrints.delete(serial);
      console.log(`Print job ${status}: job #${active.jobId}`);
    } else if (state === 'RUNNING') {
      // Update layer count
      if (p.layer_num && p.layer_num !== active.lastLayer) {
        db.prepare('UPDATE print_jobs SET layer_count=? WHERE id=?').run(p.layer_num, active.jobId);
        activePrints.set(serial, { ...active, lastLayer: p.layer_num });
      }
    }
  }
}

export function startMqttService() {
  try {
    const db = getDb();
    const printers = db.prepare('SELECT * FROM printers WHERE is_active = 1').all();
    for (const printer of printers) {
      connectPrinter(printer);
    }
    console.log(`MQTT service started — ${printers.length} printer(s)`);
  } catch (err) {
    console.warn('MQTT service start skipped:', err.message);
  }
}

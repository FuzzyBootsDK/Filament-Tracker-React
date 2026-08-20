import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../../../data');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, 'filament.db');
let db;

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function initDB() {
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  createSchema();
  migrate();
  seedDefaults();
  console.log('SQLite ready:', DB_PATH);
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS filaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      brand_id INTEGER REFERENCES brands(id),
      material TEXT NOT NULL DEFAULT 'PLA',
      color_hex TEXT NOT NULL DEFAULT '#ffffff',
      color_name TEXT,
      finish TEXT DEFAULT 'Basic',
      density REAL DEFAULT 1.24,
      price_per_kg REAL DEFAULT 149,
      spool_weight INTEGER DEFAULT 1000,
      low_stock_threshold INTEGER DEFAULT 150,
      nozzle_temp INTEGER DEFAULT 220,
      bed_temp INTEGER DEFAULT 65,
      location TEXT DEFAULT '',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS spools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filament_id INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
      remaining_weight REAL NOT NULL DEFAULT 1000,
      spool_type TEXT NOT NULL DEFAULT 'non-reusable',
      purchase_price REAL,
      is_active INTEGER DEFAULT 1,
      location TEXT,
      tag_uid TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reusable_spools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      weight REAL DEFAULT 165,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS printers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      model TEXT,
      ip_address TEXT NOT NULL,
      access_code TEXT NOT NULL,
      serial_number TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ams_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
      ams_unit INTEGER NOT NULL DEFAULT 0,
      slot_index INTEGER NOT NULL,
      spool_id INTEGER REFERENCES spools(id) ON DELETE SET NULL,
      tag_uid TEXT,
      remain_percent REAL,
      color_hex TEXT,
      material TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(printer_id, ams_unit, slot_index)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printer_id INTEGER REFERENCES printers(id) ON DELETE SET NULL,
      printer_name TEXT,
      file_name TEXT,
      started_at TEXT,
      ended_at TEXT,
      status TEXT DEFAULT 'completed',
      filament_used_g REAL,
      layer_count INTEGER,
      total_layers INTEGER,
      duration_minutes INTEGER,
      spool_id INTEGER REFERENCES spools(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function migrate() {
  try { db.exec('ALTER TABLE spools ADD COLUMN reusable_spool_id INTEGER REFERENCES reusable_spools(id) ON DELETE SET NULL'); } catch {}
  try { db.exec('ALTER TABLE ams_slots ADD COLUMN sub_brand TEXT'); } catch {}
  try { db.exec('ALTER TABLE ams_slots ADD COLUMN tray_id_name TEXT'); } catch {}
  try { db.exec('ALTER TABLE ams_slots ADD COLUMN unit_temp REAL'); } catch {}
  try { db.exec('ALTER TABLE ams_slots ADD COLUMN unit_humidity TEXT'); } catch {}
  try { db.exec('ALTER TABLE ams_slots ADD COLUMN unit_slot_count INTEGER'); } catch {}
}

function seedDefaults() {
  const insertSetting = db.prepare(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`
  );
  const defaults = [
    ['currency', 'DKK'],
    ['low_stock_threshold', '150'],
    ['relay_enabled', 'false'],
    ['relay_port', '1883'],
    ['hourly_rate', '250'],
    ['vat_rate', '25'],
  ];
  for (const [key, value] of defaults) insertSetting.run(key, value);

  const insertBrand = db.prepare(`INSERT OR IGNORE INTO brands (name) VALUES (?)`);
  const brands = [
    'Bambu Lab',
    'Prusament',
    'eSUN',
    'Polymaker',
    'Hatchbox',
    'Sunlu',
    'ColorFabb',
    'Filamentum',
    'Extrudr',
    'Fiberlogy',
    'FormFutura',
    'AzureFilm',
    'Devil Design',
    'Das Filament',
    'Real Filament',
    'Overture',
    'ERYONE',
    'Nobufil',
    'Primafilaments',
    'Proto-pasta',
    'MatterHackers',
    'Amolen',
    'Print With Smile',
  ];
  for (const name of brands) insertBrand.run(name);
}

// Helper: node:sqlite returns lastInsertRowid as BigInt — normalise to Number
export function rowId(result) {
  return Number(result.lastInsertRowid);
}

// Manual transaction helper (node:sqlite has no db.transaction() shorthand)
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

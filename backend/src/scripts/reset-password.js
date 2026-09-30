// Reset a user's password back to their own username.
//
//   reset-password.ps1 / .sh          # list users
//   reset-password.ps1 lasse          # set lasse's password to "lasse"
//
// Works against the same SQLite file the server uses (DATA_DIR or ../../../data).
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../../../data');
const DB_PATH = join(DATA_DIR, 'filament.db');

if (!existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH} — start the app once first.`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

const username = process.argv[2];

if (!username) {
  const users = db.prepare('SELECT id, username, is_admin FROM users ORDER BY id').all();
  if (!users.length) {
    console.log('No users yet — the app will run first-time setup on next login page load.');
  } else {
    console.log('Users:');
    for (const u of users) console.log(`  ${u.id}  ${u.username}${u.is_admin ? '  (admin)' : ''}`);
    console.log('\nUsage: pass a username to reset it, e.g. reset-password.ps1 <username>');
  }
  process.exit(0);
}

const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username);
if (!user) {
  console.error(`No user named "${username}". Run without arguments to list users.`);
  process.exit(1);
}

const hash = bcrypt.hashSync(user.username, 10);
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

console.log(`Password for "${user.username}" is now: ${user.username}`);

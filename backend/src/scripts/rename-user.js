// Rename a user (e.g. to fix a typo made during first-time setup).
//
//   rename-user.ps1 / .sh                  # list users
//   rename-user.ps1 Guvballe Gulvballe     # rename Guvballe -> Gulvballe
//
// The password is unchanged by a rename. Since reset-password sets the password
// to the username, run reset-password afterwards to keep the two in sync.
//
// Works against the same SQLite file the server uses (DATA_DIR or ../../../data).
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '../../../data');
const DB_PATH = join(DATA_DIR, 'filament.db');

if (!existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH} — start the app once first.`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

const listUsers = () => db.prepare('SELECT id, username, is_admin FROM users ORDER BY id').all();

const [oldName, newName] = process.argv.slice(2);

if (!oldName || !newName) {
  const users = listUsers();
  if (!users.length) {
    console.log('No users yet — the app will run first-time setup on next login page load.');
  } else {
    console.log('Users:');
    for (const u of users) console.log(`  ${u.id}  ${u.username}${u.is_admin ? '  (admin)' : ''}`);
    console.log('\nUsage: rename-user.ps1 <current-username> <new-username>');
  }
  process.exit(0);
}

// Usernames are matched case-sensitively everywhere else (login included), so
// keep this exact too — no surprise matches.
const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(oldName);
if (!user) {
  console.error(`No user named "${oldName}". Run without arguments to list users.`);
  process.exit(1);
}

if (db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newName, user.id)) {
  console.error(`A different user is already named "${newName}".`);
  process.exit(1);
}

db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newName, user.id);

console.log(`Renamed "${oldName}" -> "${newName}" (id ${user.id}).`);
console.log(`Password is unchanged — it is still the old username ("${oldName}").`);

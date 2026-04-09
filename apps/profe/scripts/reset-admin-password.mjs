/**
 * Restablece la contraseña de todos los usuarios con rol admin en la BD local de Electron.
 * Usa sql.js (sin better-sqlite3) para no depender del Node de Electron.
 *
 * Uso: node scripts/reset-admin-password.mjs <nueva_clave> [ruta\a\gestor_academico.db]
 *
 * Cierra Gestor Académico antes de ejecutar (evita bloqueo del archivo en Windows).
 */
import bcrypt from 'bcryptjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const password = process.argv[2];
const customDb = process.argv[3];

if (!password || password.length < 8) {
  console.error('Uso: node scripts/reset-admin-password.mjs <nueva_clave> [ruta_al_gestor_academico.db]');
  console.error('La clave debe tener al menos 8 caracteres.');
  process.exit(1);
}

function defaultDbPath() {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'gestor-academico', 'database', 'gestor_academico.db');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'gestor-academico', 'database', 'gestor_academico.db');
  }
  return path.join(home, '.config', 'gestor-academico', 'database', 'gestor_academico.db');
}

const dbPath = customDb ? path.resolve(customDb) : defaultDbPath();

if (!fs.existsSync(dbPath)) {
  console.error('No se encontró la base de datos en:', dbPath);
  console.error('Cierra la app e indica la ruta manualmente como segundo argumento.');
  process.exit(1);
}

const pkgRoot = path.join(__dirname, '..');
const wasmPath = path.join(pkgRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
if (!fs.existsSync(wasmPath)) {
  console.error('No se encontró sql-wasm.wasm en node_modules/sql.js. Ejecuta npm install.');
  process.exit(1);
}

const wasmBinary = fs.readFileSync(wasmPath);
const SQL = await initSqlJs({ wasmBinary });

const fileBuf = fs.readFileSync(dbPath);
const db = new SQL.Database(new Uint8Array(fileBuf));

const table = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='app_users'");
if (!table.length) {
  console.error('La tabla app_users no existe.');
  db.close();
  process.exit(1);
}

const before = db.exec("SELECT id, email, role FROM app_users WHERE role = 'admin'");
const count = before[0]?.values?.length ?? 0;
if (count === 0) {
  const all = db.exec('SELECT id, email, role FROM app_users');
  console.error('No hay usuarios con role = admin.');
  if (all.length && all[0].values.length) {
    console.error('Usuarios actuales:', all[0].values);
  }
  db.close();
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const now = Date.now();

db.run('UPDATE app_users SET password_hash = ?, updated_at = ? WHERE role = ?', [hash, now, 'admin']);

const out = db.export();
fs.writeFileSync(dbPath, Buffer.from(out));
db.close();

console.log('Listo. Base:', dbPath);
console.log('Administradores actualizados:', count);
console.log('Inicia sesión con tu correo y la nueva contraseña.');

/**
 * Descarga/compila el .node de better-sqlite3 (Windows: evita node-gyp si hay prebuild).
 * Uso: npm run rebuild:sqlite
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const root = path.join(__dirname, "..");
const cwd = path.join(root, "node_modules", "better-sqlite3");
const bin = path.join(root, "node_modules", "prebuild-install", "bin.js");

if (!fs.existsSync(cwd)) {
  console.error("Falta node_modules/better-sqlite3. Ejecute npm install en la raíz del repo.");
  process.exit(1);
}
if (!fs.existsSync(bin)) {
  console.error("Falta prebuild-install. Ejecute npm install en la raíz del repo.");
  process.exit(1);
}

const r = spawnSync(process.execPath, [bin], { cwd, stdio: "inherit", env: { ...process.env, DEBUG: process.env.DEBUG || "" } });
process.exit(r.status === null ? 1 : r.status);

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * Raíz del monorepo (DomainSlayer/.env).
 * Desde `apps/backend/src` o `apps/backend/dist` hay que subir **3** niveles, no 2 (2 caían en `apps/.env`).
 */
const monorepoRootEnv = path.resolve(__dirname, "..", "..", "..", ".env");

/**
 * Carga `.env` por cwd (`npm run dev --prefix apps/backend` deja cwd en `apps/backend`).
 * Sin `override`, la primera aparición de cada clave gana: un `OPENAI_API_KEY=` vacío en
 * `apps/backend/.env` impedía usar la clave del `.env` de la raíz.
 * Al final cargamos el `.env` de la raíz del repo con `override: true` para que gane lo definido ahí.
 */
for (const envPath of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
  path.resolve(process.cwd(), "..", "..", ".env"),
]) {
  loadDotenv({ path: envPath });
}
loadDotenv({ path: monorepoRootEnv, override: true });

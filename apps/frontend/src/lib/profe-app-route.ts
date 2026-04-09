/**
 * Fallback cuando el JWT no trae `homeApp` (tokens viejos o solo env).
 * Preferencia: columna `home_app` en BD → claim JWT → aquí.
 * Configurar en `.env` del build de **ambas** apps (inventario y profe) con el mismo criterio:
 * - `VITE_PROFE_EMAILS` — lista exacta separada por comas: `profe1@escuela.edu,otro@x.com`
 * - `VITE_PROFE_EMAIL_SUFFIXES` — sufijos: `@escuela.edu,@midominio.org`
 */
export function emailShouldUseProfeApp(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e) return false;

  const exactRaw = import.meta.env.VITE_PROFE_EMAILS?.trim();
  if (exactRaw) {
    const set = new Set(
      exactRaw
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    );
    if (set.has(e)) return true;
  }

  const sufRaw = import.meta.env.VITE_PROFE_EMAIL_SUFFIXES?.trim();
  if (sufRaw) {
    const suffixes = sufRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (suffixes.some((s) => e.endsWith(s))) return true;
  }

  return false;
}

/**
 * Si el JWT trae `homeApp` del servidor, manda; si no (tokens viejos), se usa `VITE_PROFE_*`.
 */
export function sessionUsesProfeApp(email: string, homeApp?: string | null): boolean {
  if (homeApp === "profe") return true;
  if (homeApp === "inventory") return false;
  return emailShouldUseProfeApp(email);
}

/** Ruta base de la otra SPA (producción: mismo origen). */
export function profeAppBasePath(): string {
  const base = import.meta.env.VITE_PROFE_BASE_PATH?.trim() || "/profe";
  return base.startsWith("/") ? base : `/${base}`;
}

export function profeAppEntryUrl(): string {
  const path = profeAppBasePath().replace(/\/$/, "") || "/profe";
  if (typeof window === "undefined") return `${path}/`;
  if (import.meta.env.DEV) {
    const dev = import.meta.env.VITE_PROFE_DEV_ORIGIN?.trim();
    if (dev) return `${dev.replace(/\/$/, "")}${path}/`;
  }
  return `${window.location.origin}${path}/`;
}

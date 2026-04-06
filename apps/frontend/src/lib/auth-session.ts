import { AUTH_STORAGE_KEY } from "../api";

/** Nombre en pantalla sincronizado con login o con «Nombre y rol» (sin esperar un JWT nuevo). */
const DISPLAY_NAME_SESSION_KEY = "ds_display_name";

export type AuthRole = "admin" | "viewer";

export type AuthPayload = {
  sub: string;
  email: string;
  role: AuthRole;
  /** Nombre de persona (`display_name` en BD); vacío si no está definido o si el token solo traía la parte local del correo. */
  name: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const p = token.split(".")[1];
    if (!p) return null;
    const json = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    return json;
  } catch {
    return null;
  }
}

/** Lee el JWT en sessionStorage. Tokens antiguos sin `role` se tratan como administrador. */
export function readAuthPayload(): AuthPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  const t = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!t) return null;
  const json = decodeJwtPayload(t);
  if (!json || typeof json.sub !== "string" || typeof json.email !== "string") return null;
  const role: AuthRole = json.role === "viewer" ? "viewer" : "admin";
  const email = json.email;
  const nameRaw = typeof json.name === "string" ? json.name.trim() : "";
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at).toLowerCase() : "";
  /** Solo nombre real del API; si el token trae solo la parte local del correo (tokens viejos), no lo mostramos como nombre. */
  const name =
    nameRaw && (!local || nameRaw.toLowerCase() !== local) ? nameRaw : "";
  return { sub: json.sub, email, role, name };
}

export function isAdminSession(): boolean {
  return readAuthPayload()?.role === "admin";
}

export function getSessionDisplayName(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    return sessionStorage.getItem(DISPLAY_NAME_SESSION_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

const DISPLAY_NAME_EVENT = "ds-display-name";

/** Llamar tras login (desde `user.displayName`) o al guardar el propio nombre en Usuarios; `null` limpia. */
export function setSessionDisplayName(value: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const v = value?.trim();
    if (v) sessionStorage.setItem(DISPLAY_NAME_SESSION_KEY, v);
    else sessionStorage.removeItem(DISPLAY_NAME_SESSION_KEY);
    window.dispatchEvent(new Event(DISPLAY_NAME_EVENT));
  } catch {
    /* ignorar */
  }
}

/** Texto en el menú: JWT, caché de sesión (perfil actualizado) y por último el correo. */
export function sidebarUserLabel(p: AuthPayload): string {
  const fromJwt = p.name.trim();
  const fromCache = getSessionDisplayName();
  return fromJwt || fromCache || p.email;
}


const AUTH_KEY = "ds_jwt";

export type AuthPayload = {
  sub: string;
  email: string;
  role: string;
  name: string;
  homeApp?: "inventory" | "profe";
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const p = token.split(".")[1];
    if (!p) return null;
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readAuthPayload(): AuthPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  const t = sessionStorage.getItem(AUTH_KEY);
  if (!t) return null;
  const json = decodeJwtPayload(t);
  if (!json || typeof json.sub !== "string" || typeof json.email !== "string") return null;
  const nameRaw = typeof json.name === "string" ? json.name.trim() : "";
  const ha = json.homeApp;
  const homeApp: "inventory" | "profe" | undefined =
    ha === "profe" ? "profe" : ha === "inventory" ? "inventory" : undefined;
  return {
    sub: json.sub,
    email: json.email,
    role: typeof json.role === "string" ? json.role : "admin",
    name: nameRaw,
    homeApp,
  };
}

export function clearAuth(): void {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem("ds_display_name");
  } catch {
    /* ignorar */
  }
}

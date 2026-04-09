/** Misma lógica que `apps/frontend/src/lib/profe-app-route.ts` (mismas variables `VITE_*`). */
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

export function sessionUsesProfeApp(email: string, homeApp?: string | null): boolean {
  if (homeApp === "profe") return true;
  if (homeApp === "inventory") return false;
  return emailShouldUseProfeApp(email);
}

/** Origen del SPA de inventario (en dev, si abre profe en otro puerto). */
export function inventoryAppUrl(): string {
  const inv = import.meta.env.VITE_INVENTORY_DEV_ORIGIN?.trim();
  if (import.meta.env.DEV && inv) return inv.replace(/\/$/, "") + "/";
  if (typeof window === "undefined") return "/";
  return `${window.location.origin}/`;
}

export function inventoryLoginPageUrl(): string {
  return `${inventoryAppUrl().replace(/\/$/, "")}/login`;
}

export function inventoryLoginUrl(nextPath: string): string {
  const base = inventoryAppUrl().replace(/\/$/, "");
  return `${base}/login?next=${encodeURIComponent(nextPath)}`;
}

import type { SiteRow } from "../types";

/** Días de calendario desde hoy hasta la fecha (UTC); negativo si ya pasó. */
export function calendarDaysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.round((endDay - start) / 86_400_000);
}

export type ExpiryUrgency = "red" | "yellow";

/** Coincide con el backend: rojo si vencido o quedan menos de 3 días; amarillo 3–10 días. */
export const EXPIRY_CRITICAL_DAYS = 3;

export function urgencyFromDays(days: number): ExpiryUrgency | null {
  if (days < 0) return "red";
  if (days < EXPIRY_CRITICAL_DAYS) return "red";
  if (days <= 10) return "yellow";
  return null;
}

export interface ExpiryLine {
  kind: "ssl" | "domain";
  days: number;
  urgency: ExpiryUrgency;
}

export interface SiteExpiryProximityRow {
  site: SiteRow;
  worst: ExpiryUrgency;
  lines: ExpiryLine[];
}

function collectLine(
  iso: string | null,
  statusExpired: boolean,
  kind: "ssl" | "domain"
): ExpiryLine | null {
  if (iso) {
    const days = calendarDaysUntil(iso);
    if (days === null) return null;
    const u = urgencyFromDays(days);
    if (u) return { kind, days, urgency: u };
    return null;
  }
  if (statusExpired) {
    return { kind, days: -1, urgency: "red" };
  }
  return null;
}

/** Sitios con SSL o dominio en ventana ≤10 días (o marcados vencidos). */
export function buildSitesExpiryProximity(sites: SiteRow[]): SiteExpiryProximityRow[] {
  const rows: SiteExpiryProximityRow[] = [];

  for (const site of sites) {
    const lines: ExpiryLine[] = [];
    const ssl = collectLine(site.sslValidTo, site.sslStatus === "expired", "ssl");
    if (ssl) lines.push(ssl);
    const dom = collectLine(site.domainExpiryFinal, site.domainExpiryStatus === "expired", "domain");
    if (dom) lines.push(dom);

    if (lines.length === 0) continue;

    const worst = lines.some((l) => l.urgency === "red") ? "red" : "yellow";
    rows.push({ site, worst, lines });
  }

  rows.sort((a, b) => {
    const minA = Math.min(...a.lines.map((l) => l.days));
    const minB = Math.min(...b.lines.map((l) => l.days));
    if (a.worst !== b.worst) return a.worst === "red" ? -1 : 1;
    return minA - minB;
  });

  return rows;
}

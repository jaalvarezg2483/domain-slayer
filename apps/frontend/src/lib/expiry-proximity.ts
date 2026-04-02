import { calendarDayDiffLocal } from "./calendar-day-local";
import type { SiteRow } from "../types";

/** Días de calendario desde hoy hasta la fecha, según el calendario local del navegador (no UTC). */
export function calendarDaysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  return calendarDayDiffLocal(new Date(), end);
}

export type ExpiryUrgency = "red" | "orange";

/** Alineado con alertas: rojo si vencido o &lt;5 días; naranja de 5 a 10 días (inclusive). */
export const EXPIRY_CRITICAL_DAYS = 5;

export function urgencyFromDays(days: number): ExpiryUrgency | null {
  if (days < 0) return "red";
  if (days < EXPIRY_CRITICAL_DAYS) return "red";
  if (days <= 10) return "orange";
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
    const sslIso = site.sslValidToFinal ?? site.sslValidTo;
    const ssl = collectLine(sslIso, site.sslStatus === "expired", "ssl");
    if (ssl) lines.push(ssl);
    const dom = collectLine(site.domainExpiryFinal, site.domainExpiryStatus === "expired", "domain");
    if (dom) lines.push(dom);

    if (lines.length === 0) continue;

    const worst = lines.some((l) => l.urgency === "red") ? "red" : "orange";
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

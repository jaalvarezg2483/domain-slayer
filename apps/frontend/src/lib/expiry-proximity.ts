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

/** Líneas SSL/dominio dentro de la ventana del panel (≤10 días o vencido). */
function collectExpiryLinesInWindow(site: SiteRow): ExpiryLine[] {
  const lines: ExpiryLine[] = [];
  const sslIso = site.sslValidToFinal ?? site.sslValidTo;
  const ssl = collectLine(sslIso, site.sslStatus === "expired", "ssl");
  if (ssl) lines.push(ssl);
  const dom = collectLine(site.domainExpiryFinal, site.domainExpiryStatus === "expired", "domain");
  if (dom) lines.push(dom);
  return lines;
}

/** Sitios con SSL o dominio en ventana ≤10 días (o marcados vencidos). */
export function buildSitesExpiryProximity(sites: SiteRow[]): SiteExpiryProximityRow[] {
  const rows: SiteExpiryProximityRow[] = [];

  for (const site of sites) {
    const lines = collectExpiryLinesInWindow(site);
    if (lines.length === 0) continue;

    const worst = lines.some((l) => l.urgency === "red") ? "red" : "orange";
    rows.push({ site, worst, lines });
  }

  rows.sort((a, b) => {
    if (a.worst !== b.worst) return a.worst === "red" ? -1 : 1;
    const minA = Math.min(...a.lines.map((l) => l.days));
    const minB = Math.min(...b.lines.map((l) => l.days));
    if (minA !== minB) return minA - minB;
    return a.site.siteName.localeCompare(b.site.siteName, "es");
  });

  return rows;
}

/**
 * Orden para «Estado por sitio»: rojo (panel) primero, luego naranja, luego el resto por próximo vencimiento (días).
 */
export function compareSitesForDashboardTable(a: SiteRow, b: SiteRow): number {
  const linesA = collectExpiryLinesInWindow(a);
  const linesB = collectExpiryLinesInWindow(b);

  const tier = (lines: ExpiryLine[]) => {
    if (lines.length === 0) return 2;
    return lines.some((l) => l.urgency === "red") ? 0 : 1;
  };
  const minPanelDays = (lines: ExpiryLine[]) =>
    lines.length ? Math.min(...lines.map((l) => l.days)) : 9999;

  const ta = tier(linesA);
  const tb = tier(linesB);
  if (ta !== tb) return ta - tb;
  if (ta < 2) {
    const da = minPanelDays(linesA);
    const db = minPanelDays(linesB);
    if (da !== db) return da - db;
    return a.siteName.localeCompare(b.siteName, "es");
  }

  const nextDays = (s: SiteRow) => {
    const sslIso = s.sslValidToFinal ?? s.sslValidTo;
    const dSsl = sslIso ? calendarDaysUntil(sslIso) : null;
    const dDom = s.domainExpiryFinal ? calendarDaysUntil(s.domainExpiryFinal) : null;
    const vals = [dSsl, dDom].filter((x): x is number => x !== null);
    return vals.length ? Math.min(...vals) : 99999;
  };
  const na = nextDays(a);
  const nb = nextDays(b);
  if (na !== nb) return na - nb;
  return a.siteName.localeCompare(b.siteName, "es");
}

export function sortSitesForDashboardTable(sites: SiteRow[]): SiteRow[] {
  return [...sites].sort(compareSitesForDashboardTable);
}

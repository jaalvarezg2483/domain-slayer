import { calendarDayDiffInTimeZone, DEFAULT_CALENDAR_TIME_ZONE } from "./calendar-days.js";
import { DEFAULT_ALERT_DAY_THRESHOLDS } from "./constants.js";

/** Misma ventana que el panel «Alertas de vencimiento» y el correo (purdy-notification-email). */
export const PANEL_EXPIRY_WINDOW_DAYS = 10;
export const PANEL_EXPIRY_CRITICAL_DAYS = 5;

export type PanelExpirySiteSlice = {
  sslValidToFinal?: Date | string | null;
  sslValidTo?: Date | string | null;
  domainExpiryFinal?: Date | string | null;
  sslStatus?: string;
  domainExpiryStatus?: string;
};

function panelCalendarTz(): string {
  const z = typeof process !== "undefined" && process.env.CALENDAR_TIME_ZONE?.trim();
  return z || DEFAULT_CALENDAR_TIME_ZONE;
}

function coerceDate(d: unknown): Date | null {
  if (d == null) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  if (typeof d === "string" || typeof d === "number") {
    const x = new Date(d);
    return Number.isNaN(x.getTime()) ? null : x;
  }
  return null;
}

function urgencyFromDays(days: number): "red" | "orange" | null {
  if (days < 0) return "red";
  if (days < PANEL_EXPIRY_CRITICAL_DAYS) return "red";
  if (days <= PANEL_EXPIRY_WINDOW_DAYS) return "orange";
  return null;
}

type PanelProximityLine = { urgency: "red" | "orange"; days: number };

function collectPanelProximityLines(site: PanelExpirySiteSlice, now: Date): PanelProximityLine[] {
  const lines: PanelProximityLine[] = [];
  const push = (date: Date | null, expiredFlag: boolean) => {
    if (date) {
      const days = calendarDayDiffInTimeZone(now, date, panelCalendarTz());
      const u = urgencyFromDays(days);
      if (u) lines.push({ urgency: u, days });
    } else if (expiredFlag) {
      lines.push({ urgency: "red", days: -1 });
    }
  };
  const sslEff = coerceDate(site.sslValidToFinal) ?? coerceDate(site.sslValidTo);
  push(sslEff, site.sslStatus === "expired");
  const dom = coerceDate(site.domainExpiryFinal);
  push(dom, site.domainExpiryStatus === "expired");

  /* Si el chequeo marcó «por vencer» pero la fecha cae fuera de la ventana corta del panel (≤10 días), igual priorizar en listados. */
  if (lines.length === 0) {
    const sslRed = site.sslStatus === "expired";
    const domRed = site.domainExpiryStatus === "expired";
    if (sslRed || domRed) {
      lines.push({ urgency: "red", days: -1 });
    } else if (site.sslStatus === "expiring_soon" || site.domainExpiryStatus === "expiring_soon") {
      const tz = panelCalendarTz();
      const sslEff = coerceDate(site.sslValidToFinal) ?? coerceDate(site.sslValidTo);
      const dom = coerceDate(site.domainExpiryFinal);
      const cands: number[] = [];
      if (sslEff) cands.push(calendarDayDiffInTimeZone(now, sslEff, tz));
      if (dom) cands.push(calendarDayDiffInTimeZone(now, dom, tz));
      const d = cands.length > 0 ? Math.min(...cands) : 999;
      const u: "red" | "orange" = d < 0 ? "red" : d < PANEL_EXPIRY_CRITICAL_DAYS ? "red" : "orange";
      lines.push({ urgency: u, days: d });
    }
  }

  /* Mismo horizonte que el monitoreo (umbrales hasta 60 días): «por vencer» en la UI debe subir aunque el estado no esté refrescado. */
  const alertMaxDays = Math.max(...DEFAULT_ALERT_DAY_THRESHOLDS);
  const tz = panelCalendarTz();
  for (const date of [
    coerceDate(site.sslValidToFinal) ?? coerceDate(site.sslValidTo),
    coerceDate(site.domainExpiryFinal),
  ]) {
    if (!date) continue;
    const days = calendarDayDiffInTimeZone(now, date, tz);
    if (days < 0) lines.push({ urgency: "red", days });
    else if (days < PANEL_EXPIRY_CRITICAL_DAYS) lines.push({ urgency: "red", days });
    else if (days <= alertMaxDays) lines.push({ urgency: "orange", days });
  }

  return lines;
}

/**
 * Sitio «próximo a vencer» en el sentido del panel: SSL o dominio en ≤10 días, o vencido.
 * Usa `sslValidToFinal ?? sslValidTo` y `domainExpiryFinal`, misma lógica que el correo.
 */
export function siteInPanelExpiryProximityWindow(site: PanelExpirySiteSlice, now = new Date()): boolean {
  return collectPanelProximityLines(site, now).length > 0;
}

/** Incluye salud para alinear con badges «Correcto / Atención» de la tabla. */
export type PanelProximitySortSite = PanelExpirySiteSlice & { siteName: string; healthStatus?: string };

function sslTierRed(ssl: string | undefined): boolean {
  return ssl === "expired" || ssl === "tls_error" || ssl === "hostname_mismatch";
}

function sslTierOrange(ssl: string | undefined): boolean {
  return ssl === "expiring_soon";
}

/**
 * 0 = rojo (crítico / vencido / error SSL grave), 1 = naranja (atención / por vencer), 2 = resto.
 * Combina panel de fechas con los mismos estados que muestra la UI.
 */
function listUrgencyTier(site: PanelProximitySortSite, lines: PanelProximityLine[]): number {
  const hasPanelRed = lines.some((l) => l.urgency === "red");
  const hasPanelOrange = lines.some((l) => l.urgency === "orange");

  const health = site.healthStatus;
  const ssl = site.sslStatus;
  const dom = site.domainExpiryStatus;

  if (health === "critical" || sslTierRed(ssl) || dom === "expired" || hasPanelRed) {
    return 0;
  }
  if (health === "warning" || sslTierOrange(ssl) || dom === "expiring_soon" || hasPanelOrange) {
    return 1;
  }
  return 2;
}

function minPanelLineDays(lines: PanelProximityLine[]): number {
  return lines.length ? Math.min(...lines.map((l) => l.days)) : 9999;
}

function nextExpiryDaysAny(site: PanelExpirySiteSlice, now: Date): number {
  const ssl = coerceDate(site.sslValidToFinal) ?? coerceDate(site.sslValidTo);
  const dom = coerceDate(site.domainExpiryFinal);
  const vals: number[] = [];
  if (ssl) vals.push(calendarDayDiffInTimeZone(now, ssl, panelCalendarTz()));
  if (dom) vals.push(calendarDayDiffInTimeZone(now, dom, panelCalendarTz()));
  return vals.length ? Math.min(...vals) : 99999;
}

/** Días para ordenar dentro del mismo nivel: líneas del panel o, si no hay, próximo vencimiento. */
function sortDaysWithinTier(site: PanelProximitySortSite, lines: PanelProximityLine[], now: Date): number {
  if (lines.length > 0) return minPanelLineDays(lines);
  return nextExpiryDaysAny(site, now);
}

/**
 * Inventario / panel: rojo → naranja → verde; dentro de cada grupo por días (menos días primero).
 * Usa `CALENDAR_TIME_ZONE` en fechas y los mismos `healthStatus` / `sslStatus` que la tabla.
 */
export function compareSitesByPanelProximity(
  a: PanelProximitySortSite,
  b: PanelProximitySortSite,
  now = new Date()
): number {
  const linesA = collectPanelProximityLines(a, now);
  const linesB = collectPanelProximityLines(b, now);
  const ta = listUrgencyTier(a, linesA);
  const tb = listUrgencyTier(b, linesB);
  if (ta !== tb) return ta - tb;
  const da = sortDaysWithinTier(a, linesA, now);
  const db = sortDaysWithinTier(b, linesB, now);
  if (da !== db) return da - db;
  return a.siteName.localeCompare(b.siteName, "es");
}

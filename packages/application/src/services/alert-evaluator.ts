import type { Alert, Site } from "@domain-slayer/domain";
import type { MonitoringCheckResult } from "../monitoring/types.js";
import {
  ALERT_EXPIRING_CRITICAL_MAX_DAYS,
  calendarDayDiffInTimeZone,
  DEFAULT_ALERT_DAY_THRESHOLDS,
  DEFAULT_CALENDAR_TIME_ZONE,
} from "@domain-slayer/shared";

function alertCalendarTz(): string {
  const z = process.env.CALENDAR_TIME_ZONE?.trim();
  return z || DEFAULT_CALENDAR_TIME_ZONE;
}

function calendarDaysUntil(from: Date, to: Date): number {
  return calendarDayDiffInTimeZone(from, to, alertCalendarTz());
}

/** Misma lógica que MonitoringRunner: hay aviso de vencimiento si quedan ≤ algún umbral (p. ej. 4 ≤ 60). */
function isWithinExpiryAlertWindow(daysRemaining: number, thresholds: readonly number[]): boolean {
  return daysRemaining >= 0 && thresholds.some((t) => daysRemaining <= t);
}

export function buildAlertsFromCheck(
  site: Site,
  result: MonitoringCheckResult,
  thresholds: readonly number[] = DEFAULT_ALERT_DAY_THRESHOLDS
): Omit<Alert, "id" | "createdAt">[] {
  const now = new Date();
  const out: Omit<Alert, "id" | "createdAt">[] = [];

  if (result.sslStatus === "expired") {
    out.push({
      siteId: site.id,
      alertType: "ssl_expired",
      severity: "critical",
      message: `SSL vencido para ${site.domain}`,
      isRead: false,
      isResolved: false,
    });
  } else if (
    result.sslStatus === "hostname_mismatch" ||
    (result.sslStatus === "tls_error" && !site.sslValidToFinal)
  ) {
    out.push({
      siteId: site.id,
      alertType: "ssl_error",
      severity: "critical",
      message: `Error SSL (${result.sslStatus}) en ${site.domain}: ${result.errorMessage ?? ""}`,
      isRead: false,
      isResolved: false,
    });
  } else if (site.sslValidToFinal) {
    const d = calendarDaysUntil(now, site.sslValidToFinal);
    if (isWithinExpiryAlertWindow(d, thresholds)) {
      out.push({
        siteId: site.id,
        alertType: "ssl_expiring",
        severity: d < ALERT_EXPIRING_CRITICAL_MAX_DAYS ? "critical" : "warning",
        message: `SSL de ${site.domain} vence en ${d} día(s); válido hasta el ${site.sslValidToFinal.toISOString().slice(0, 10)}`,
        isRead: false,
        isResolved: false,
      });
    }
  }

  const manual = site.domainExpiryManual;
  const auto = result.domainExpiryAuto;
  if (manual && site.domainExpirySource === "manual" && auto) {
    const dayDiff = Math.abs(
      Math.round((manual.getTime() - auto.getTime()) / (1000 * 60 * 60 * 24))
    );
    if (dayDiff > 1) {
      const ma = manual.toISOString().slice(0, 10);
      const aa = auto.toISOString().slice(0, 10);
      out.push({
        siteId: site.id,
        alertType: "domain_registry_differs_from_manual",
        severity: "warning",
        message: `Dominio ${site.domain}: la fecha manual (${ma}) difiere de la obtenida por RDAP/WHOIS (${aa}). Revise cuál es la correcta en «Editar sitio».`,
        isRead: false,
        isResolved: false,
      });
    }
  }

  const finalExpiry = site.domainExpiryFinal;
  if (finalExpiry) {
    const dd = calendarDaysUntil(now, finalExpiry);
    if (dd < 0) {
      out.push({
        siteId: site.id,
        alertType: "domain_expiring",
        severity: "critical",
        message: `Dominio ${site.domain} posiblemente vencido (fecha final)`,
        isRead: false,
        isResolved: false,
      });
    } else if (isWithinExpiryAlertWindow(dd, thresholds)) {
      out.push({
        siteId: site.id,
        alertType: "domain_expiring",
        severity: dd < ALERT_EXPIRING_CRITICAL_MAX_DAYS ? "critical" : "warning",
        message: `Dominio ${site.domain} vence en ${dd} día(s); fecha fin ${finalExpiry.toISOString().slice(0, 10)}`,
        isRead: false,
        isResolved: false,
      });
    }
  } else if (site.domainExpirySource === "unavailable" && !site.domainExpiryManual) {
    out.push({
      siteId: site.id,
      alertType: "domain_unknown_expiry",
      severity: "info",
      message: `No hay fecha de expiración automática para ${site.domain}; complete manualmente si aplica`,
      isRead: false,
      isResolved: false,
    });
  }

  if (result.dnsStatus === "error") {
    out.push({
      siteId: site.id,
      alertType: "dns_error",
      severity: "warning",
      message: `DNS con problemas para ${site.domain}`,
      isRead: false,
      isResolved: false,
    });
  }
  if (result.httpStatus === "error") {
    out.push({
      siteId: site.id,
      alertType: "http_error",
      severity: "warning",
      message: `HTTP no responde correctamente para ${site.url}`,
      isRead: false,
      isResolved: false,
    });
  }
  if (result.httpsStatus === "error") {
    out.push({
      siteId: site.id,
      alertType: "https_error",
      severity: "warning",
      message: `HTTPS no responde correctamente para ${site.url}`,
      isRead: false,
      isResolved: false,
    });
  }

  return out;
}

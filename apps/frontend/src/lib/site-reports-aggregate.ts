import type { AlertRow, SiteRow } from "../types";
import {
  labelAlertType,
  labelCheckStatus,
  labelDnsStatus,
  labelDomainExpiryStatus,
  labelEnvironment,
  labelHealthStatus,
  labelHttpStatus,
  labelSeverity,
  labelSslStatus,
} from "./status-labels";

/** Fila de sitio tal como viene del API (campos operativos opcionales en listados). */
export type SiteReportRow = SiteRow & {
  checkStatus?: string;
  httpStatus?: string;
  httpsStatus?: string;
  dnsStatus?: string;
  domainStatus?: string;
};

export type NamedCount = { key: string; name: string; value: number; fill: string };

function bump(map: Map<string, number>, key: string) {
  const k = key?.trim() || "unknown";
  map.set(k, (map.get(k) ?? 0) + 1);
}

function mapToNamed(
  map: Map<string, number>,
  label: (k: string) => string,
  color: (k: string) => string
): NamedCount[] {
  return Array.from(map.entries())
    .map(([key, value]) => ({ key, name: label(key), value, fill: color(key) }))
    .sort((a, b) => b.value - a.value);
}

const MUTED = "#8b9aab";

export function healthColor(k: string): string {
  switch (k) {
    case "healthy":
      return "#34c759";
    case "warning":
      return "#ff9f0a";
    case "critical":
      return "#ff453a";
    default:
      return MUTED;
  }
}

export function sslColor(k: string): string {
  switch (k) {
    case "valid":
      return "#34c759";
    case "expiring_soon":
      return "#ff9f0a";
    case "expired":
    case "tls_error":
    case "hostname_mismatch":
      return "#ff453a";
    default:
      return MUTED;
  }
}

export function checkColor(k: string): string {
  switch (k) {
    case "success":
      return "#34c759";
    case "partial":
      return "#ff9f0a";
    case "failed":
      return "#ff453a";
    default:
      return MUTED;
  }
}

export function httpColor(k: string): string {
  switch (k) {
    case "ok":
      return "#34c759";
    case "error":
      return "#ff453a";
    default:
      return MUTED;
  }
}

export function dnsColor(k: string): string {
  switch (k) {
    case "ok":
      return "#34c759";
    case "warning":
      return "#ff9f0a";
    case "error":
      return "#ff453a";
    default:
      return MUTED;
  }
}

export function domainExpiryColor(k: string): string {
  switch (k) {
    case "ok":
      return "#34c759";
    case "expiring_soon":
      return "#ff9f0a";
    case "expired":
      return "#ff453a";
    default:
      return MUTED;
  }
}

export function severityColor(k: string): string {
  switch (k) {
    case "info":
      return "#64d2ff";
    case "warning":
      return "#ff9f0a";
    case "critical":
      return "#ff453a";
    default:
      return MUTED;
  }
}

const ENV_COLORS = ["#3d8bfd", "#64d2ff", "#bf5af2", "#34c759", "#ff9f0a", MUTED];

export function environmentColor(i: number): string {
  return ENV_COLORS[i % ENV_COLORS.length] ?? MUTED;
}

export function aggregateHealth(sites: SiteReportRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const s of sites) bump(m, s.healthStatus ?? "unknown");
  return mapToNamed(m, labelHealthStatus, healthColor);
}

export function aggregateSsl(sites: SiteReportRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const s of sites) bump(m, s.sslStatus ?? "unknown");
  return mapToNamed(m, labelSslStatus, sslColor);
}

export function aggregateEnvironment(sites: SiteReportRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const s of sites) bump(m, s.environment ?? "unknown");
  const arr = mapToNamed(m, labelEnvironment, () => MUTED);
  return arr.map((row, i) => ({ ...row, fill: environmentColor(i) }));
}

export function aggregateActive(sites: SiteReportRow[]): NamedCount[] {
  let active = 0;
  let inactive = 0;
  for (const s of sites) {
    if (s.isActive !== false) active += 1;
    else inactive += 1;
  }
  return [
    { key: "active", name: "Activos (en chequeos)", value: active, fill: "#34c759" },
    { key: "inactive", name: "Inactivos", value: inactive, fill: MUTED },
  ].filter((x) => x.value > 0);
}

export function aggregateCheckStatus(sites: SiteReportRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const s of sites) bump(m, s.checkStatus ?? "unknown");
  return mapToNamed(m, labelCheckStatus, checkColor);
}

export function aggregateHttps(sites: SiteReportRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const s of sites) bump(m, s.httpsStatus ?? "unknown");
  return mapToNamed(m, labelHttpStatus, httpColor);
}

export function aggregateDns(sites: SiteReportRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const s of sites) bump(m, s.dnsStatus ?? "unknown");
  return mapToNamed(m, labelDnsStatus, dnsColor);
}

export function aggregateDomainExpiry(sites: SiteReportRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const s of sites) bump(m, s.domainExpiryStatus ?? "unknown");
  return mapToNamed(m, labelDomainExpiryStatus, domainExpiryColor);
}

export function aggregateAlertSeverity(alerts: AlertRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const a of alerts) bump(m, a.severity ?? "unknown");
  return mapToNamed(m, labelSeverity, severityColor);
}

export function aggregateAlertType(alerts: AlertRow[]): NamedCount[] {
  const m = new Map<string, number>();
  for (const a of alerts) bump(m, a.alertType ?? "unknown");
  return mapToNamed(m, labelAlertType, () => "#3d8bfd");
}

export function reportSummary(sites: SiteReportRow[], alerts: AlertRow[]) {
  const total = sites.length;
  const active = sites.filter((s) => s.isActive !== false).length;
  const healthy = sites.filter((s) => s.healthStatus === "healthy").length;
  const pctHealthy = total > 0 ? Math.round((healthy / total) * 100) : 0;
  return { total, active, inactive: total - active, openAlerts: alerts.length, healthy, pctHealthy };
}

import type { Alert, AlertType, Site } from "@domain-slayer/domain";
import {
  calendarDayDiffInTimeZone,
  DEFAULT_CALENDAR_TIME_ZONE,
} from "@domain-slayer/shared";

const LOGO_CID = "purdylogo@grupopurdy";

export { LOGO_CID };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtDateEs(d: Date | string | null | undefined): string {
  if (d == null) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dt);
}

function fmtDateTimeEs(d: Date | string | null | undefined): string {
  if (d == null) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dt);
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\r\n|\n|\r/g, "<br/>");
}

export function alertTypeLabel(t: AlertType): string {
  const m: Partial<Record<AlertType, string>> = {
    ssl_expiring: "SSL por vencer",
    ssl_expired: "SSL vencido",
    ssl_error: "Error SSL",
    domain_expiring: "Dominio por vencer / vencido",
    domain_unknown_expiry: "Dominio sin fecha",
    domain_registry_differs_from_manual: "Fecha dominio (manual vs registro)",
    dns_error: "DNS",
    http_error: "HTTP",
    https_error: "HTTPS",
  };
  return m[t] ?? t;
}

function isSslFamily(t: AlertType): boolean {
  return t === "ssl_expiring" || t === "ssl_expired" || t === "ssl_error";
}

function isDomainFamily(t: AlertType): boolean {
  return (
    t === "domain_expiring" ||
    t === "domain_unknown_expiry" ||
    t === "domain_registry_differs_from_manual"
  );
}

function rowHasExpiryAlert(r: PurdySiteEmailRow): boolean {
  return r.alerts.some((a) => isSslFamily(a.alertType) || isDomainFamily(a.alertType));
}

/** Misma ventana que el panel «Alertas de vencimiento» (expiry-proximity.ts). */
const PANEL_EXPIRY_WINDOW_DAYS = 10;
const PANEL_EXPIRY_CRITICAL_DAYS = 5;

function panelCalendarTz(): string {
  const z = process.env.CALENDAR_TIME_ZONE?.trim();
  return z || DEFAULT_CALENDAR_TIME_ZONE;
}

function calendarDaysUntilPanel(d: Date | null | undefined): number | null {
  if (d == null) return null;
  const end = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(end.getTime())) return null;
  return calendarDayDiffInTimeZone(new Date(), end, panelCalendarTz());
}

function panelUrgencyFromDays(days: number): "red" | "orange" | null {
  if (days < 0) return "red";
  if (days < PANEL_EXPIRY_CRITICAL_DAYS) return "red";
  if (days <= PANEL_EXPIRY_WINDOW_DAYS) return "orange";
  return null;
}

function collectPanelExpiryLine(
  date: Date | null | undefined,
  expiredFlag: boolean,
  kind: "ssl" | "domain"
): { text: string; urgency: "red" | "orange"; days: number } | null {
  const label = kind === "ssl" ? "SSL" : "Dominio";
  if (date) {
    const days = calendarDaysUntilPanel(date);
    if (days === null) return null;
    const u = panelUrgencyFromDays(days);
    if (!u) return null;
    const dateStr = fmtDateEs(date);
    let text: string;
    if (days < 0) text = `${label} vencido`;
    else if (days === 0) text = `${label} vence hoy (${dateStr})`;
    else text = `${label} vence en ${days} día${days === 1 ? "" : "s"} (${dateStr})`;
    return { text, urgency: u, days };
  }
  if (expiredFlag) return { text: `${label} vencido`, urgency: "red", days: -1 };
  return null;
}

/**
 * Sección 1 = mismos sitios que «Alertas de vencimiento» en el panel (fechas del último chequeo).
 * Sección 2 = HTTP/HTTPS/DNS solo en sitios que no están ya en la sección 1.
 */
export function buildExpiryEmailRowsFromSites(sites: Site[], openAlerts: Alert[]): {
  expiryRows: PurdySiteEmailRow[];
  opsOnlyRows: PurdySiteEmailRow[];
} {
  const alertBySite = new Map<string, Alert[]>();
  for (const a of openAlerts) {
    const list = alertBySite.get(a.siteId) ?? [];
    list.push(a);
    alertBySite.set(a.siteId, list);
  }

  const activeSites = sites.filter((s) => s.isActive !== false);
  const expiryRows: PurdySiteEmailRow[] = [];

  for (const site of activeSites) {
    const dashLines: { text: string; urgency: "red" | "orange"; days: number }[] = [];
    const sslEff = site.sslValidToFinal ?? site.sslValidTo;
    const l1 = collectPanelExpiryLine(sslEff, site.sslStatus === "expired", "ssl");
    if (l1) dashLines.push(l1);
    const l2 = collectPanelExpiryLine(site.domainExpiryFinal, site.domainExpiryStatus === "expired", "domain");
    if (l2) dashLines.push(l2);
    if (dashLines.length === 0) continue;

    expiryRows.push({
      siteId: site.id,
      siteName: site.siteName,
      domain: site.domain,
      sslValidTo: sslEff,
      domainExpiryFinal: site.domainExpiryFinal,
      sslResolutionNotes: site.sslResolutionNotes,
      domainResolutionNotes: site.domainResolutionNotes,
      alerts: alertBySite.get(site.id) ?? [],
      dashboardExpiryLines: dashLines,
    });
  }

  expiryRows.sort(compareExpiryRowsByPanelUrgency);

  const expiryIds = new Set(expiryRows.map((r) => r.siteId));
  const opsOnlyRows: PurdySiteEmailRow[] = [];

  for (const site of activeSites) {
    if (expiryIds.has(site.id)) continue;
    const als = alertBySite.get(site.id) ?? [];
    if (als.length === 0) continue;
    opsOnlyRows.push({
      siteId: site.id,
      siteName: site.siteName,
      domain: site.domain,
      sslValidTo: site.sslValidToFinal ?? site.sslValidTo,
      domainExpiryFinal: site.domainExpiryFinal,
      sslResolutionNotes: site.sslResolutionNotes,
      domainResolutionNotes: site.domainResolutionNotes,
      alerts: als,
    });
  }
  opsOnlyRows.sort((a, b) => a.siteName.localeCompare(b.siteName, "es"));

  return { expiryRows, opsOnlyRows };
}

export type PurdySiteEmailRow = {
  siteId: string;
  siteName: string;
  domain: string;
  sslValidTo: Date | null;
  domainExpiryFinal: Date | null;
  sslResolutionNotes: string | null;
  domainResolutionNotes: string | null;
  alerts: Alert[];
  /** Textos iguales al panel «Alertas de vencimiento». */
  dashboardExpiryLines?: { text: string; urgency: "red" | "orange"; days: number }[];
};

export type PurdyEmailBuildInput = {
  mode: "schedule" | "test";
  sitesChecked: number;
  reason: string;
  critical: number;
  warning: number;
  openTotal: number;
  expiryRows: PurdySiteEmailRow[];
  opsOnlyRows: PurdySiteEmailRow[];
  useLogoCid: boolean;
  publicAppUrl?: string | null;
  /** Marca de tiempo del run programado (servidor) para comprobar que el automatismo corrió. */
  lastRunAt?: Date | string | null;
};

export function partitionRowsForEmail(rows: PurdySiteEmailRow[]): {
  expiryRows: PurdySiteEmailRow[];
  opsOnlyRows: PurdySiteEmailRow[];
} {
  return {
    expiryRows: rows.filter(rowHasExpiryAlert),
    opsOnlyRows: rows.filter((r) => !rowHasExpiryAlert(r)),
  };
}

/** Días hasta vencimiento (panel): mínimo entre líneas SSL/dominio en ventana. */
export function minPanelExpiryDays(r: PurdySiteEmailRow): number {
  if (!r.dashboardExpiryLines?.length) return 9999;
  return Math.min(...r.dashboardExpiryLines.map((x) => x.days));
}

/**
 * 0 = al menos una línea roja (SSL o dominio crítico/vencido en panel).
 * 1 = solo naranja (ventana de advertencia).
 * 2 = sin líneas (no debería ocurrir en filas de vencimiento).
 */
export function panelExpiryUrgencyTier(r: PurdySiteEmailRow): number {
  const lines = r.dashboardExpiryLines;
  if (!lines?.length) return 2;
  if (lines.some((l) => l.urgency === "red")) return 0;
  if (lines.some((l) => l.urgency === "orange")) return 1;
  return 2;
}

/** Rojos primero, luego naranjas; dentro de cada grupo por días restantes (menor primero) y nombre. */
export function compareExpiryRowsByPanelUrgency(a: PurdySiteEmailRow, b: PurdySiteEmailRow): number {
  const ta = panelExpiryUrgencyTier(a);
  const tb = panelExpiryUrgencyTier(b);
  if (ta !== tb) return ta - tb;
  const da = minPanelExpiryDays(a);
  const db = minPanelExpiryDays(b);
  if (da !== db) return da - db;
  return a.siteName.localeCompare(b.siteName, "es");
}

export function sortExpiryRowsByPanelUrgency(rows: PurdySiteEmailRow[]): PurdySiteEmailRow[] {
  return [...rows].sort(compareExpiryRowsByPanelUrgency);
}

function severityBadge(sev: string): string {
  const bg =
    sev === "critical"
      ? "#3d1515"
      : sev === "warning"
        ? "#3d3010"
        : "#152a35";
  const fg =
    sev === "critical" ? "#ffb4b0" : sev === "warning" ? "#ffd78a" : "#a8d4e8";
  const label =
    sev === "critical" ? "crítica" : sev === "warning" ? "advertencia" : sev === "info" ? "info" : sev;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${bg};color:${fg};">${escapeHtml(label)}</span>`;
}

function otherAlertsHtml(alerts: Alert[]): string {
  const rest = alerts.filter((a) => !isSslFamily(a.alertType) && !isDomainFamily(a.alertType));
  if (rest.length === 0) return "";
  const lines = rest.map(
    (a) =>
      `<span style="font-size:12px;color:#b8c5d4;">• ${escapeHtml(alertTypeLabel(a.alertType))}: ${escapeHtml(a.message)}</span>`
  );
  return `<tr><td colspan="5" style="padding:8px 12px 14px 12px;background:#0d1218;border-top:1px solid #243044;font-family:system-ui,-apple-system,sans-serif;">${lines.join("<br/>")}</td></tr>`;
}

function buildExpirySectionHtml(expiryRows: PurdySiteEmailRow[]): string {
  if (expiryRows.length === 0) return "";
  const headerCells = `
      <tr style="background:#0d1520;">
        <th align="left" style="padding:10px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7a8fa3;border-bottom:1px solid #2a3544;font-family:system-ui,-apple-system,sans-serif;">Sitio</th>
        <th align="left" style="padding:10px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7a8fa3;border-bottom:1px solid #2a3544;font-family:system-ui,-apple-system,sans-serif;">SSL vence</th>
        <th align="left" style="padding:10px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7a8fa3;border-bottom:1px solid #2a3544;font-family:system-ui,-apple-system,sans-serif;">Cómo resolver (SSL)</th>
        <th align="left" style="padding:10px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7a8fa3;border-bottom:1px solid #2a3544;font-family:system-ui,-apple-system,sans-serif;">Dominio vence</th>
        <th align="left" style="padding:10px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7a8fa3;border-bottom:1px solid #2a3544;font-family:system-ui,-apple-system,sans-serif;">Cómo resolver (dominio)</th>
      </tr>`;

  const dataRows = expiryRows
    .map((r) => {
      const sslAlerts = r.alerts.filter((a) => isSslFamily(a.alertType));
      const domAlerts = r.alerts.filter((a) => isDomainFamily(a.alertType));
      const sslNote = (r.sslResolutionNotes ?? "").trim() || "—";
      const domNote = (r.domainResolutionNotes ?? "").trim() || "—";
      const sslBadges = sslAlerts.map((a) => severityBadge(a.severity)).join(" ");
      const domBadges = domAlerts.map((a) => severityBadge(a.severity)).join(" ");

      const dashHtml =
        r.dashboardExpiryLines?.length ?
          r.dashboardExpiryLines
            .map(
              (l) =>
                `<div style="font-size:12px;font-weight:600;margin-top:6px;line-height:1.4;color:${
                  l.urgency === "red" ? "#ff9a93" : "#f0c674"
                };">${escapeHtml(l.text)}</div>`
            )
            .join("")
        : "";

      return `
      <tr>
        <td style="padding:12px 10px;vertical-align:top;border-bottom:1px solid #243044;font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#e8eef5;background:#151b24;">
          <strong style="color:#f2f6fb;">${escapeHtml(r.siteName)}</strong><br/>
          <span style="font-size:12px;color:#8b9aab;">${escapeHtml(r.domain)}</span>
          ${dashHtml}
          ${sslBadges || domBadges ? `<div style="margin-top:6px;">${sslBadges} ${domBadges}</div>` : ""}
        </td>
        <td style="padding:12px 10px;vertical-align:top;border-bottom:1px solid #243044;font-size:12px;color:#c5d0dc;background:#151b24;">${fmtDateEs(r.sslValidTo)}</td>
        <td style="padding:12px 10px;vertical-align:top;border-bottom:1px solid #243044;font-size:12px;color:#b8c9d8;line-height:1.45;background:#151b24;">${sslNote === "—" ? "—" : nl2br(sslNote)}</td>
        <td style="padding:12px 10px;vertical-align:top;border-bottom:1px solid #243044;font-size:12px;color:#c5d0dc;background:#151b24;">${fmtDateEs(r.domainExpiryFinal)}</td>
        <td style="padding:12px 10px;vertical-align:top;border-bottom:1px solid #243044;font-size:12px;color:#b8c9d8;line-height:1.45;background:#151b24;">${domNote === "—" ? "—" : nl2br(domNote)}</td>
      </tr>${otherAlertsHtml(r.alerts)}`;
    })
    .join("");

  return `
      <tr>
        <td style="padding:0;background:#121820;">
          <p style="margin:0;padding:14px 16px 6px 16px;font-size:12px;font-weight:600;color:#64d2ff;font-family:system-ui,-apple-system,sans-serif;">1. Alertas de vencimiento (mismo criterio que el panel)</p>
          <p style="margin:0;padding:0 16px 10px 16px;font-size:11px;color:#8b9aab;line-height:1.45;font-family:system-ui,-apple-system,sans-serif;">Sitios con SSL o dominio en ventana ≤${PANEL_EXPIRY_WINDOW_DAYS} días (o vencidos), según el último chequeo. Las columnas muestran fechas y notas de resolución. Si el sitio también falla HTTP/HTTPS, esos avisos van debajo de la fila.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-family:system-ui,-apple-system,sans-serif;">
            ${headerCells}
            ${dataRows}
          </table>
        </td>
      </tr>`;
}

function buildOpsSectionHtml(opsOnlyRows: PurdySiteEmailRow[]): string {
  if (opsOnlyRows.length === 0) return "";
  const rows = opsOnlyRows
    .map((r) => {
      const lines = r.alerts
        .map(
          (a) =>
            `<span style="font-size:12px;color:#b8c5d4;">${severityBadge(a.severity)} ${escapeHtml(alertTypeLabel(a.alertType))}: ${escapeHtml(a.message)}</span>`
        )
        .join("<br/>");
      return `<tr>
        <td style="padding:12px 10px;vertical-align:top;border-bottom:1px solid #243044;font-size:13px;color:#e8eef5;background:#151b24;">
          <strong style="color:#f2f6fb;">${escapeHtml(r.siteName)}</strong><br/>
          <span style="font-size:12px;color:#8b9aab;">${escapeHtml(r.domain)}</span>
        </td>
        <td style="padding:12px 10px;vertical-align:top;border-bottom:1px solid #243044;font-size:12px;line-height:1.5;background:#151b24;">${lines}</td>
      </tr>`;
    })
    .join("");

  return `
      <tr>
        <td style="padding:0;background:#121820;">
          <p style="margin:0;padding:16px 16px 6px 16px;font-size:12px;font-weight:600;color:#7eb8e8;font-family:system-ui,-apple-system,sans-serif;">2. Otras alertas (secundario)</p>
          <p style="margin:0;padding:0 16px 10px 16px;font-size:11px;color:#8b9aab;line-height:1.45;font-family:system-ui,-apple-system,sans-serif;">Sitios con alertas abiertas que <strong>no</strong> están en la ventana de vencimiento del panel (sección 1). Suele ser HTTP/HTTPS/DNS u otros avisos. Si el sitio ya salió arriba, los fallos de conectividad van bajo esa fila.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-family:system-ui,-apple-system,sans-serif;">
            <tr style="background:#0d1520;">
              <th align="left" style="padding:10px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7a8fa3;border-bottom:1px solid #2a3544;">Sitio</th>
              <th align="left" style="padding:10px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7a8fa3;border-bottom:1px solid #2a3544;">Alertas</th>
            </tr>
            ${rows}
          </table>
        </td>
      </tr>`;
}

function buildHeaderBlock(useLogoCid: boolean): string {
  if (useLogoCid) {
    return `
      <tr>
        <td style="padding:28px 24px 20px 24px;text-align:center;background:linear-gradient(145deg,#0a1628 0%,#152a4a 55%,#0d2038 100%);border-radius:12px 12px 0 0;">
          <img src="cid:${LOGO_CID}" alt="Grupo Purdy" width="200" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:none;" />
          <p style="margin:14px 0 0 0;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#7eb8e8;">Estado sitios Web Purdy</p>
        </td>
      </tr>`;
  }
  return `
      <tr>
        <td style="padding:28px 24px 22px 24px;text-align:center;background:linear-gradient(145deg,#0a1628 0%,#152a4a 55%,#0d2038 100%);border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.06em;color:#f2f6fb;font-family:Georgia,'Times New Roman',serif;">GRUPO PURDY</p>
          <p style="margin:10px 0 0 0;font-size:14px;font-weight:600;color:#64d2ff;font-family:system-ui,-apple-system,sans-serif;">Estado sitios Web Purdy</p>
        </td>
      </tr>`;
}

export function buildPurdyNotificationHtml(input: PurdyEmailBuildInput): string {
  const { mode, sitesChecked, reason, critical, warning, openTotal, expiryRows, opsOnlyRows, useLogoCid } = input;
  const appUrl = input.publicAppUrl?.trim() || "";
  const totalDetailRows = expiryRows.length + opsOnlyRows.length;

  const summaryLine =
    mode === "test"
      ? "Notificación manual. La <strong>sección 1</strong> copia el criterio de «Alertas de vencimiento» del panel (fechas del último chequeo), no solo la tabla de alertas."
      : `Chequeo automático completado (${escapeHtml(reason)}). Sitios revisados: <strong>${sitesChecked}</strong>.`;

  const statsRow = `
    <tr>
      <td style="padding:16px 20px;background:#151b24;border-bottom:1px solid #2a3544;font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#c5d0dc;line-height:1.5;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:4px 8px 4px 0;width:50%;vertical-align:top;">
              <span style="color:#8b9aab;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Alertas abiertas (registro)</span><br/>
              <span style="font-size:20px;font-weight:700;color:#e8eef5;">${openTotal}</span>
              <span style="color:#8b9aab;font-size:12px;"> &nbsp;·&nbsp; críticas ${critical} · advertencias ${warning}</span>
              <div style="margin-top:10px;padding-top:10px;border-top:1px solid #2a3544;">
                <span style="color:#64d2ff;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Prioridad panel — vencimientos</span><br/>
                <span style="font-size:18px;font-weight:700;color:#e8eef5;">${expiryRows.length}</span>
                <span style="color:#8b9aab;font-size:12px;"> sitio(s) en ventana ≤${PANEL_EXPIRY_WINDOW_DAYS} días (como «Alertas de vencimiento»)</span>
              </div>
            </td>
            <td style="padding:4px 0 4px 8px;width:50%;vertical-align:top;text-align:right;">
              ${appUrl ? `<a href="${escapeHtml(appUrl)}" style="display:inline-block;margin-top:4px;padding:8px 16px;background:rgba(100,210,255,0.12);border:1px solid rgba(100,210,255,0.35);border-radius:8px;color:#a8e6ff;font-size:12px;font-weight:600;text-decoration:none;">Abrir inventario</a>` : ""}
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0 0;font-size:13px;color:#a8b8c8;">${summaryLine}</p>
      </td>
    </tr>`;

  let tableBody = "";
  if (totalDetailRows === 0) {
    const emptyMsg =
      mode === "test"
        ? "No hay alertas abiertas en este momento; el inventario está al día respecto a los umbrales actuales."
        : openTotal === 0
          ? "No hay alertas abiertas. Los certificados y dominios están dentro de los umbrales configurados."
          : "No se pudieron cargar los detalles de los sitios con alertas.";
    tableBody = `
      <tr>
        <td style="padding:28px 20px;text-align:center;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#a8b8c8;line-height:1.55;background:#121820;">
          ${emptyMsg}
        </td>
      </tr>`;
  } else {
    const chunks: string[] = [];
    if (expiryRows.length === 0 && opsOnlyRows.length > 0) {
      chunks.push(`
      <tr>
        <td style="padding:14px 18px;font-size:12px;color:#a8b8c8;line-height:1.5;background:#121820;font-family:system-ui,-apple-system,sans-serif;">
          Ningún sitio cumple ahora el criterio de «Alertas de vencimiento» del panel (SSL/dominio ≤${PANEL_EXPIRY_WINDOW_DAYS} días o vencido). Las filas siguientes son solo conectividad o DNS.
        </td>
      </tr>`);
    }
    chunks.push(buildExpirySectionHtml(expiryRows));
    chunks.push(buildOpsSectionHtml(opsOnlyRows));
    tableBody = chunks.join("");
  }

  const runTs = fmtDateTimeEs(input.lastRunAt);
  const footerLines =
    mode === "schedule" && runTs
      ? `Ejecutado: <strong style="color:#8b9aab;">${escapeHtml(runTs)}</strong> (hora del servidor).<br/>`
      : mode === "test"
        ? `Envío manual de prueba.<br/>`
        : "";

  const footer = `
      <tr>
        <td style="padding:18px 20px 24px 20px;text-align:center;font-size:11px;color:#5c6b7a;line-height:1.6;font-family:system-ui,-apple-system,sans-serif;background:#0f1419;border-radius:0 0 12px 12px;border:1px solid #243044;border-top:none;">
          ${footerLines}
          Grupo Purdy · Inventario de sitios Web<br/>
          ${mode === "schedule" ? "Este correo se genera automáticamente tras cada chequeo programado." : ""}
        </td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0e12;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#0a0e12;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;border-collapse:collapse;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.35);">
          ${buildHeaderBlock(useLogoCid)}
          ${statsRow}
          ${tableBody}
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function appendRowText(lines: string[], r: PurdySiteEmailRow): void {
  lines.push(`— ${r.siteName} (${r.domain})`);
  if (r.dashboardExpiryLines?.length) {
    for (const l of r.dashboardExpiryLines) {
      lines.push(`  * ${l.text}`);
    }
  }
  lines.push(`  SSL vence: ${fmtDateEs(r.sslValidTo)}`);
  const sn = (r.sslResolutionNotes ?? "").trim();
  lines.push(`  Resolver SSL: ${sn || "—"}`);
  lines.push(`  Dominio vence: ${fmtDateEs(r.domainExpiryFinal)}`);
  const dn = (r.domainResolutionNotes ?? "").trim();
  lines.push(`  Resolver dominio: ${dn || "—"}`);
  for (const a of r.alerts) {
    lines.push(`  [${a.severity}] ${alertTypeLabel(a.alertType)}: ${a.message}`);
  }
  lines.push("");
}

export function buildPurdyNotificationText(input: PurdyEmailBuildInput): string {
  const lines: string[] = [];
  lines.push("Estado sitios Web Purdy");
  lines.push("");
  if (input.mode === "test") {
    lines.push("Notificación manual desde el panel.");
  } else {
    lines.push(`Chequeo: ${input.reason}. Sitios revisados: ${input.sitesChecked}.`);
    const ts = fmtDateTimeEs(input.lastRunAt);
    if (ts) lines.push(`Ejecutado (servidor): ${ts}.`);
  }
  lines.push(
    `Alertas abiertas: ${input.openTotal} (críticas: ${input.critical}, advertencias: ${input.warning}).`
  );
  lines.push("");
  if (input.expiryRows.length > 0) {
    lines.push("--- Vencimientos (criterio panel) ---");
    for (const r of input.expiryRows) appendRowText(lines, r);
  }
  if (input.opsOnlyRows.length > 0) {
    lines.push("--- Otras alertas (fuera de ventana panel) ---");
    for (const r of input.opsOnlyRows) appendRowText(lines, r);
  }
  if (input.publicAppUrl?.trim()) {
    lines.push(`Inventario: ${input.publicAppUrl.trim()}`);
  }
  return lines.join("\n");
}

export async function loadSiteRowsForAlerts(
  broker: { call: (name: string, params: object) => Promise<unknown> },
  alerts: Alert[]
): Promise<PurdySiteEmailRow[]> {
  const bySite = new Map<string, Alert[]>();
  for (const a of alerts) {
    const list = bySite.get(a.siteId) ?? [];
    list.push(a);
    bySite.set(a.siteId, list);
  }
  const rows: PurdySiteEmailRow[] = [];
  for (const siteId of bySite.keys()) {
    try {
      const site = (await broker.call("inventory.sites.get", { id: siteId })) as Site;
      rows.push({
        siteId: site.id,
        siteName: site.siteName,
        domain: site.domain,
        sslValidTo: site.sslValidToFinal ?? site.sslValidTo,
        domainExpiryFinal: site.domainExpiryFinal,
        sslResolutionNotes: site.sslResolutionNotes,
        domainResolutionNotes: site.domainResolutionNotes,
        alerts: bySite.get(siteId) ?? [],
      });
    } catch {
      /* sitio eliminado */
    }
  }
  rows.sort((a, b) => a.siteName.localeCompare(b.siteName, "es"));
  return rows;
}

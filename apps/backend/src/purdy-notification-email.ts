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

export function alertTypeLabel(t: AlertType): string {
  const m: Partial<Record<AlertType, string>> = {
    ssl_expiring: "SSL próximo a vencer",
    ssl_expired: "SSL vencido",
    ssl_error: "Error SSL",
    domain_expiring: "Dominio próximo a vencer / vencido",
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

/** Igual que el panel: sitios en ventana con peor urgencia roja (&lt;5 días o vencido) vs solo naranja (5–10 días). */
export function countExpiryPanelBuckets(expiryRows: PurdySiteEmailRow[]): {
  lessThan5Days: number;
  fiveTo10Days: number;
} {
  let lessThan5Days = 0;
  let fiveTo10Days = 0;
  for (const r of expiryRows) {
    const lines = r.dashboardExpiryLines;
    if (!lines?.length) continue;
    if (lines.some((l) => l.urgency === "red")) lessThan5Days++;
    else fiveTo10Days++;
  }
  return { lessThan5Days, fiveTo10Days };
}

export type PurdyEmailBuildInput = {
  mode: "schedule" | "test";
  sitesChecked: number;
  /** Sitios activos en inventario (tarjeta «Sitios activos» del panel). Si falta, se usa sitesChecked. */
  activeSitesCount?: number;
  reason: string;
  critical: number;
  warning: number;
  openTotal: number;
  expiryRows: PurdySiteEmailRow[];
  opsOnlyRows: PurdySiteEmailRow[];
  useLogoCid: boolean;
  /**
   * Si true, aplica filter:invert al PNG incrustado (logo oscuro → claro en correo).
   * Desactivar cuando el archivo ya es negro sobre blanco (p. ej. grupo-purdy-logo-notify.png).
   */
  invertEmailLogo?: boolean;
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
      ? "#ffebee"
      : sev === "warning"
        ? "#fff3e0"
        : "#eceff1";
  const fg = sev === "critical" ? "#b71c1c" : sev === "warning" ? "#e65100" : "#000000";
  const label =
    sev === "critical" ? "crítica" : sev === "warning" ? "advertencia" : sev === "info" ? "info" : sev;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${bg};color:${fg};border:1px solid rgba(0,0,0,0.08);">${escapeHtml(label)}</span>`;
}

function buildExpirySectionHtml(expiryRows: PurdySiteEmailRow[]): string {
  if (expiryRows.length === 0) return "";
  const th =
    "padding:14px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1a1a1a;border-bottom:2px solid #d0d0d0;font-family:system-ui,-apple-system,sans-serif;text-align:center;vertical-align:middle;";
  const headerCells = `
      <tr style="background:#eceff1;">
        <th style="${th}">Sitio</th>
        <th style="${th}">SSL vence</th>
        <th style="${th}">Cómo resolver (SSL)</th>
        <th style="${th}">Dominio vence</th>
        <th style="${th}">Cómo resolver (dominio)</th>
      </tr>`;

  const dataRows = expiryRows
    .map((r, idx) => {
      const sslAlerts = r.alerts.filter((a) => isSslFamily(a.alertType));
      const domAlerts = r.alerts.filter((a) => isDomainFamily(a.alertType));
      const sslNote = (r.sslResolutionNotes ?? "").trim() || "—";
      const domNote = (r.domainResolutionNotes ?? "").trim() || "—";
      const sslBadges = sslAlerts.map((a) => severityBadge(a.severity)).join(" ");
      const domBadges = domAlerts.map((a) => severityBadge(a.severity)).join(" ");
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8f9fa";
      const tdBase = `padding:16px 10px;vertical-align:middle;border-bottom:1px solid #e8eaed;font-family:system-ui,-apple-system,sans-serif;text-align:center;font-size:12px;color:#1a1a1a;background:${rowBg};`;

      const urgencyHtml = (r.dashboardExpiryLines ?? [])
        .map(
          (l) =>
            `<div style="margin-top:4px;font-size:12px;font-weight:700;color:${
              l.urgency === "red" ? "#c62828" : "#e65100"
            };line-height:1.35;">${escapeHtml(l.text)}</div>`
        )
        .join("");
      const badgesHtml =
        sslBadges || domBadges ?
          `<div style="margin-top:10px;line-height:1.6;">${sslBadges} ${domBadges}</div>`
        : "";

      const siteBlock = `
          <div style="text-align:center;line-height:1.45;">
            <div style="font-weight:700;font-size:14px;color:#000000;letter-spacing:-0.02em;">${escapeHtml(r.siteName)}</div>
            <div style="font-size:12px;color:#424242;margin-top:4px;">${escapeHtml(r.domain)}</div>
            ${urgencyHtml}
            ${badgesHtml}
          </div>`;

      const note = (s: string) => (s === "—" ? "—" : escapeHtml(s).replace(/\r\n|\n|\r/g, " "));

      return `
      <tr>
        <td style="${tdBase}">${siteBlock}</td>
        <td style="${tdBase}font-weight:600;">${fmtDateEs(r.sslValidTo)}</td>
        <td style="${tdBase}line-height:1.45;">${note(sslNote)}</td>
        <td style="${tdBase}font-weight:600;">${fmtDateEs(r.domainExpiryFinal)}</td>
        <td style="${tdBase}line-height:1.45;">${note(domNote)}</td>
      </tr>`;
    })
    .join("");

  return `
      <tr>
        <td style="padding:8px 20px 24px 20px;background:#ffffff;">
          <p style="margin:0;padding:20px 24px 8px 24px;font-size:15px;font-weight:700;color:#000000;font-family:system-ui,-apple-system,sans-serif;text-align:center;letter-spacing:-0.02em;">Alertas de vencimiento</p>
          <p style="margin:0;padding:0 24px 20px 24px;font-size:12px;color:#424242;line-height:1.65;font-family:system-ui,-apple-system,sans-serif;text-align:center;">Mismo criterio que el panel. SSL o dominio en ventana ≤${PANEL_EXPIRY_WINDOW_DAYS} días (o vencidos), según el último chequeo.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-family:system-ui,-apple-system,sans-serif;border:1px solid #dadce0;">
            ${headerCells}
            ${dataRows}
          </table>
        </td>
      </tr>`;
}

function buildHeaderBlock(useLogoCid: boolean, invertEmailLogo: boolean): string {
  if (useLogoCid) {
    const invertCss =
      invertEmailLogo ? "-webkit-filter:invert(1);filter:invert(1);" : "";
    const logoStyle =
      "display:block;margin:0 auto;max-width:280px;width:100%;height:auto;border:0;outline:none;" + invertCss;
    return `
      <tr>
        <td style="padding:28px 24px 22px 24px;text-align:center;background:#ffffff;border-radius:12px 12px 0 0;border-bottom:1px solid #e8eaed;">
          <img src="cid:${LOGO_CID}" alt="Grupo Purdy" width="280" style="${logoStyle}" />
          <p style="margin:18px 0 0 0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#000000;line-height:1.4;">Estado sitios Web Purdy</p>
        </td>
      </tr>`;
  }
  return `
      <tr>
        <td style="padding:28px 24px 22px 24px;text-align:center;background:#ffffff;border-radius:12px 12px 0 0;border-bottom:1px solid #e0e0e0;">
          <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.06em;color:#000000;font-family:Georgia,'Times New Roman',serif;">GRUPO PURDY</p>
          <p style="margin:10px 0 0 0;font-size:14px;font-weight:700;color:#000000;font-family:system-ui,-apple-system,sans-serif;">Estado sitios Web Purdy</p>
        </td>
      </tr>`;
}

function buildDashboardStatsGridHtml(input: PurdyEmailBuildInput): string {
  const activeSites = input.activeSitesCount ?? input.sitesChecked;
  const { lessThan5Days, fiveTo10Days } = countExpiryPanelBuckets(input.expiryRows);
  const { critical, warning, openTotal } = input;
  const cardOuter = "border:1px solid #e8eaed;border-radius:10px;background:#fafafa;";
  const labelStyle =
    "font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#616161;line-height:1.35;font-family:system-ui,-apple-system,sans-serif;";
  const numBlack =
    "font-size:30px;font-weight:700;color:#000000;line-height:1.1;font-family:system-ui,-apple-system,sans-serif;";
  const numRed = numBlack.replace("#000000", "#c62828");
  const numOrange = numBlack.replace("#000000", "#e65100");
  const subStyle =
    "font-size:12px;color:#212121;margin-top:6px;line-height:1.35;font-family:system-ui,-apple-system,sans-serif;";

  const cell = (label: string, inner: string) => `
            <td style="width:50%;padding:6px;vertical-align:top;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${cardOuter}">
                <tr>
                  <td style="padding:16px 12px;text-align:center;">
                    <div style="${labelStyle}">${escapeHtml(label)}</div>
                    ${inner}
                  </td>
                </tr>
              </table>
            </td>`;

  const row1 =
    cell("Sitios activos", `<div style="${numBlack}">${activeSites}</div>`) +
    cell(
      "Alertas abiertas",
      `<div style="${numBlack}">${openTotal}</div><div style="${subStyle}">críticas ${critical} · advertencias ${warning}</div>`
    );
  const row2 =
    cell("Vencen en menos de 5 días", `<div style="${numRed}">${lessThan5Days}</div>`) +
    cell("Vencen en 5 a 10 días", `<div style="${numOrange}">${fiveTo10Days}</div>`);

  return `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 8px 0;">
              <tr>${row1}</tr>
              <tr>${row2}</tr>
            </table>`;
}

export function buildPurdyNotificationHtml(input: PurdyEmailBuildInput): string {
  const { mode, sitesChecked, reason, openTotal, expiryRows, useLogoCid } = input;
  const invertEmailLogo = input.invertEmailLogo === true;
  const appUrl = input.publicAppUrl?.trim() || "";
  const totalDetailRows = expiryRows.length;

  const summaryLine =
    mode === "test"
      ? `Resumen con datos del inventario y criterio «Alertas de vencimiento» del panel.<br/>Sitios revisados en el chequeo: <strong>${sitesChecked === 0 ? "—" : String(sitesChecked)}</strong>.`
      : `Chequeo automático completado (${escapeHtml(reason)}).<br/>Sitios revisados: <strong>${sitesChecked}</strong>.`;

  const statsRow = `
    <tr>
      <td style="padding:24px 18px 28px 18px;background:#ffffff;border-bottom:1px solid #e8eaed;font-family:system-ui,-apple-system,sans-serif;color:#000000;text-align:center;">
        ${buildDashboardStatsGridHtml(input)}
        ${appUrl ? `<div style="margin-top:20px;"><a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:10px 24px;background:#000000;border-radius:8px;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;">Abrir inventario</a></div>` : ""}
        <p style="margin:22px 0 0 0;font-size:13px;color:#1a1a1a;line-height:1.7;max-width:520px;margin-left:auto;margin-right:auto;">${summaryLine}</p>
      </td>
    </tr>`;

  let tableBody = "";
  if (totalDetailRows === 0) {
    const emptyMsg =
      mode === "test"
        ? "No hay sitios en la ventana de vencimiento del panel con los datos actuales."
        : openTotal === 0
          ? "No hay alertas abiertas. Los certificados y dominios están dentro de los umbrales configurados."
          : `Ningún sitio cumple ahora el criterio de «Alertas de vencimiento» del panel (SSL/dominio ≤${PANEL_EXPIRY_WINDOW_DAYS} días o vencido).`;
    tableBody = `
      <tr>
        <td style="padding:28px 20px;text-align:center;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#000000;line-height:1.55;background:#ffffff;">
          ${emptyMsg}
        </td>
      </tr>`;
  } else {
    tableBody = buildExpirySectionHtml(expiryRows);
  }

  const runTs = fmtDateTimeEs(input.lastRunAt);
  const footerLines =
    mode === "schedule" && runTs
      ? `Ejecutado: <strong style="color:#000000;">${escapeHtml(runTs)}</strong> (hora del servidor).<br/>`
      : "";

  const footer = `
      <tr>
        <td style="padding:24px 24px 28px 24px;text-align:center;font-size:11px;color:#424242;line-height:1.75;font-family:system-ui,-apple-system,sans-serif;background:#ffffff;border-radius:0 0 12px 12px;border:1px solid #e8eaed;border-top:none;">
          ${footerLines}
          Grupo Purdy · Inventario de sitios Web<br/>
          ${mode === "schedule" ? "<span style=\"display:block;margin-top:8px;\">Este correo se genera automáticamente tras cada chequeo programado.</span>" : ""}
        </td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;padding:16px 8px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;">
          ${buildHeaderBlock(useLogoCid, invertEmailLogo)}
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
    if (!isSslFamily(a.alertType) && !isDomainFamily(a.alertType)) continue;
    lines.push(`  [${a.severity}] ${alertTypeLabel(a.alertType)}: ${a.message}`);
  }
  lines.push("");
}

export function buildPurdyNotificationText(input: PurdyEmailBuildInput): string {
  const lines: string[] = [];
  lines.push("Estado sitios Web Purdy");
  lines.push("");
  const activeSites = input.activeSitesCount ?? input.sitesChecked;
  const { lessThan5Days, fiveTo10Days } = countExpiryPanelBuckets(input.expiryRows);

  if (input.mode === "test") {
    lines.push("Resumen generado desde el panel con los datos actuales del inventario.");
    if (input.sitesChecked > 0) lines.push(`Sitios revisados en el chequeo: ${input.sitesChecked}.`);
  } else {
    lines.push(`Chequeo: ${input.reason}. Sitios revisados: ${input.sitesChecked}.`);
    const ts = fmtDateTimeEs(input.lastRunAt);
    if (ts) lines.push(`Ejecutado (servidor): ${ts}.`);
  }
  lines.push(`Sitios activos: ${activeSites}.`);
  lines.push(
    `Alertas abiertas: ${input.openTotal} (críticas: ${input.critical}, advertencias: ${input.warning}).`
  );
  lines.push(`Vencen en menos de 5 días: ${lessThan5Days}.`);
  lines.push(`Vencen en 5 a 10 días: ${fiveTo10Days}.`);
  lines.push("");
  if (input.expiryRows.length > 0) {
    lines.push("--- Vencimientos (criterio panel) ---");
    for (const r of input.expiryRows) appendRowText(lines, r);
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

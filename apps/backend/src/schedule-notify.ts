import fs from "node:fs";
import path from "node:path";
import type { ServiceBroker } from "moleculer";
import nodemailer from "nodemailer";
import type { Alert, Site } from "@domain-slayer/domain";
import type { MonitoringScheduleEntity } from "@domain-slayer/infrastructure";
import {
  appendRowText,
  buildExpiryEmailRowsFromSites,
  buildPurdyNotificationHtml,
  buildPurdyNotificationText,
  countExpiryPanelBuckets,
  fmtDateEs,
  LOGO_CID,
  sortExpiryRowsByPanelUrgency,
  type PurdyEmailBuildInput,
  type PurdySiteEmailRow,
} from "./purdy-notification-email.js";

function smtpTransport() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS ?? "";
  const hostLower = host.toLowerCase();
  const isGmail =
    hostLower === "smtp.gmail.com" || hostLower.endsWith(".gmail.com") || hostLower === "smtp.googlemail.com";
  const requireTls =
    process.env.SMTP_REQUIRE_TLS === "true" ||
    (process.env.SMTP_REQUIRE_TLS !== "false" && isGmail && port === 587);
  const connMs = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 20_000);
  const socketMs = Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? connMs);
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    requireTLS: requireTls,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: connMs,
    greetingTimeout: connMs,
    socketTimeout: Number.isFinite(socketMs) && socketMs > 0 ? socketMs : connMs,
    ...(process.env.SMTP_FORCE_IPV4 === "true" ? { family: 4 as const } : {}),
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  });
}

/** Mensaje de error más accionable en el panel (prueba de notificación). */
function formatSmtpOrNetworkError(channel: string, e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  let hint = "";
  if (lower.includes("timeout") || lower.includes("timed out") || raw.includes("ETIMEDOUT")) {
    hint =
      " Compruebe salida TCP al puerto SMTP (587 o 465), variables SMTP_* en el hosting y que el proveedor no bloquee SMTP; si el DNS devuelve IPv6 inaccesible, pruebe SMTP_FORCE_IPV4=true.";
  } else if (lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    hint = " Compruebe SMTP_HOST, DNS y que el firewall permita la conexión saliente.";
  }
  return `${channel}: ${raw}.${hint}`;
}

function teamsWebhookTimeoutMs(): number {
  const n = Number(process.env.TEAMS_WEBHOOK_TIMEOUT_MS ?? 30_000);
  if (!Number.isFinite(n) || n <= 0) return 30_000;
  return Math.min(n, 120_000);
}

async function fetchTeamsWebhook(webhookUrl: string, body: unknown): Promise<Response> {
  const ms = teamsWebhookTimeoutMs();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (e) {
    const err = e instanceof Error ? e : null;
    const cause = err && "cause" in err && err.cause instanceof Error ? err.cause : null;
    const aborted =
      err?.name === "AbortError" ||
      cause?.name === "AbortError" ||
      /aborted|abort/i.test(err?.message ?? "");
    const msg = err?.message ?? String(e);
    if (aborted) {
      throw new Error(
        `tiempo de espera (${ms}ms) al llamar al webhook. Compruebe salida HTTPS desde el servidor hacia Microsoft y que la URL del conector sea la actual.`,
      );
    }
    throw new Error(`red: ${msg}`);
  } finally {
    clearTimeout(t);
  }
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
}

/** Logo del correo: NO usar el PNG principal de la app si existe copia para notificaciones (fondo claro/transparente). */
function resolvePurdyLogoPath(): string | null {
  const envPath = process.env.EMAIL_LOGO_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return path.resolve(envPath);
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "apps", "backend", "assets", "grupo-purdy-logo-notify.png"),
    path.join(cwd, "apps", "frontend", "public", "grupo-purdy-logo-notify.png"),
    path.join(cwd, "public", "grupo-purdy-logo-notify.png"),
    path.join(cwd, "..", "frontend", "public", "grupo-purdy-logo-notify.png"),
    path.join(cwd, "assets", "grupo-purdy-logo-notify.png"),
    path.join(cwd, "assets", "email-logo.png"),
    path.join(cwd, "apps", "frontend", "public", "grupo-purdy-logo.png"),
    path.join(cwd, "public", "grupo-purdy-logo.png"),
    path.join(cwd, "..", "frontend", "public", "grupo-purdy-logo.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Invierte solo el PNG principal oscuro; no tocar notify/email-logo salvo EMAIL_LOGO_INVERT en rutas personalizadas. */
function invertEmailLogoForPath(logoPath: string | null): boolean {
  if (!logoPath) return false;
  if (process.env.EMAIL_LOGO_NO_INVERT === "true") return false;
  const base = path.basename(logoPath).toLowerCase();
  if (base === "grupo-purdy-logo-notify.png" || base === "email-logo.png") return false;
  if (base === "grupo-purdy-logo.png") return true;
  return process.env.EMAIL_LOGO_INVERT === "true";
}

function publicAppUrl(): string | null {
  const u = process.env.APP_PUBLIC_URL || process.env.VITE_APP_URL || process.env.FRONTEND_URL;
  return u?.trim() || null;
}

function mailAttachments(logoPath: string | null): { filename: string; path: string; cid: string }[] {
  if (!logoPath) return [];
  return [{ filename: "logo.png", path: logoPath, cid: LOGO_CID }];
}

function inventoryOpenUrl(base: string | null | undefined): string | null {
  const u = base?.trim();
  if (!u) return null;
  try {
    return new URL(u.endsWith("/") ? u : `${u}/`).href;
  } catch {
    return u.endsWith("/") ? u : `${u}/`;
  }
}

type TeamsDashboardSummary = {
  activeSites: number;
  openTotal: number;
  critical: number;
  warning: number;
  expiryRed: number;
  expiryOrange: number;
};

function teamsDashboardAdaptiveBlocks(d: TeamsDashboardSummary): Record<string, unknown>[] {
  const statBox = (
    label: string,
    value: string,
    sub?: string,
    valueColor?: "Attention" | "Warning" | "Default"
  ): Record<string, unknown> => ({
    type: "Container",
    style: "default",
    items: [
      {
        type: "TextBlock",
        text: label,
        horizontalAlignment: "Center",
        size: "Small",
        weight: "Bolder",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: value,
        horizontalAlignment: "Center",
        size: "ExtraLarge",
        weight: "Bolder",
        color: valueColor ?? "Default",
        spacing: "Small",
      },
      ...(sub ?
        [
          {
            type: "TextBlock",
            text: sub,
            horizontalAlignment: "Center",
            isSubtle: true,
            size: "Small",
            spacing: "None",
            wrap: true,
          },
        ]
      : []),
    ],
  });

  const row = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => ({
    type: "ColumnSet",
    spacing: "Small",
    columns: [
      { type: "Column", width: "stretch", items: [a] },
      { type: "Column", width: "stretch", items: [b] },
    ],
  });

  return [
    row(statBox("Sitios activos", String(d.activeSites)), statBox("Alertas abiertas", String(d.openTotal), `críticas ${d.critical} · advertencias ${d.warning}`)),
    row(
      statBox("Vencen en menos de 5 días", String(d.expiryRed), undefined, "Attention"),
      statBox("Vencen en 5 a 10 días", String(d.expiryOrange), undefined, "Warning")
    ),
  ];
}

/** Misma información que la tabla del correo (vencimientos SSL/dominio; el resto se ve en el inventario). */
function buildTeamsAdaptiveCardContent(params: {
  title: string;
  intro: string;
  expiryRows: PurdySiteEmailRow[];
  dashboard: TeamsDashboardSummary;
  facts: { name: string; value: string }[];
  appUrl: string | null;
}): Record<string, unknown> {
  const sorted = sortExpiryRowsByPanelUrgency(params.expiryRows);
  const body: Record<string, unknown>[] = [
    { type: "TextBlock", text: params.intro, wrap: true, weight: "Bolder", spacing: "None", color: "Default" },
    { type: "TextBlock", text: params.title, size: "Large", weight: "Bolder", spacing: "Medium", color: "Default" },
    ...teamsDashboardAdaptiveBlocks(params.dashboard),
  ];

  if (sorted.length > 0) {
    body.push({
      type: "TextBlock",
      text: "Alertas de vencimiento (mismo criterio que el panel y el correo)",
      weight: "Bolder",
      size: "Default",
      color: "Default",
      spacing: "Medium",
      wrap: true,
    });
    for (const r of sorted) {
      const rowItems: Record<string, unknown>[] = [
        {
          type: "TextBlock",
          text: r.siteName,
          weight: "Bolder",
          size: "Medium",
          wrap: true,
        },
        {
          type: "TextBlock",
          text: `Dominio: ${r.domain}`,
          isSubtle: true,
          size: "Small",
          spacing: "None",
          wrap: true,
        },
      ];
      for (const l of r.dashboardExpiryLines ?? []) {
        rowItems.push({
          type: "TextBlock",
          text: l.text,
          wrap: true,
          weight: "Bolder",
          spacing: "Small",
          color: l.urgency === "red" ? "Attention" : "Warning",
        });
      }
      const sslNote = (r.sslResolutionNotes ?? "").trim() || "—";
      const domNote = (r.domainResolutionNotes ?? "").trim() || "—";
      rowItems.push({
        type: "FactSet",
        spacing: "Small",
        facts: [
          { title: "SSL vence", value: fmtDateEs(r.sslValidTo) },
          { title: "Cómo resolver (SSL)", value: sslNote },
          { title: "Dominio vence", value: fmtDateEs(r.domainExpiryFinal) },
          { title: "Cómo resolver (dominio)", value: domNote },
        ],
      });
      body.push({
        type: "Container",
        style: "default",
        separator: true,
        spacing: "Small",
        items: rowItems,
      });
    }
  } else {
    body.push({
      type: "TextBlock",
      text: "Ningún sitio en la ventana de vencimiento del panel (mismo criterio que el correo).",
      wrap: true,
      isSubtle: true,
      spacing: "Small",
    });
  }

  const factLine = params.facts.map((f) => `${f.name}: ${f.value}`).join(" · ");
  body.push({
    type: "TextBlock",
    text: factLine,
    wrap: true,
    size: "Small",
    isSubtle: true,
    spacing: "Large",
  });

  const inv = inventoryOpenUrl(params.appUrl);
  const actions: Record<string, unknown>[] = [];
  if (inv) {
    actions.push({ type: "Action.OpenUrl", title: "Ver inventario / certificados", url: inv });
  }

  return {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    backgroundColor: "#FFFFFF",
    body,
    ...(actions.length ? { actions } : {}),
  };
}

/** Texto plano del MessageCard de respaldo (misma estructura que el cuerpo en texto del correo). */
function buildTeamsLegacyPlainText(intro: string, expiryRows: PurdySiteEmailRow[]): string {
  const lines = [intro, ""];
  if (expiryRows.length > 0) {
    lines.push("--- Vencimientos (criterio panel) ---");
    for (const r of sortExpiryRowsByPanelUrgency(expiryRows)) appendRowText(lines, r);
  }
  const app = publicAppUrl()?.trim();
  if (app) lines.push("", `Inventario: ${app}`);
  return lines.join("\n");
}

/** MessageCard clásico (conector entrante antiguo). */
async function postTeamsMessageCard(
  webhookUrl: string,
  title: string,
  text: string,
  facts: { name: string; value: string }[]
) {
  const body = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    themeColor: "1565C0",
    summary: title,
    title,
    text,
    sections: [{ facts }],
  };
  const res = await fetchTeamsWebhook(webhookUrl, body);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Teams webhook ${res.status}: ${t.slice(0, 200)}`);
  }
}

/**
 * Intenta Adaptive Card (como en Teams / Flujos de trabajo); si el extremo rechaza el formato, usa MessageCard.
 */
async function postTeams(
  webhookUrl: string,
  params: {
    title: string;
    intro: string;
    expiryRows: PurdySiteEmailRow[];
    dashboard: TeamsDashboardSummary;
    facts: { name: string; value: string }[];
    appUrl: string | null;
    /** Texto plano para el fallback MessageCard. */
    legacyText: string;
  }
) {
  const card = buildTeamsAdaptiveCardContent(params);
  const adaptivePayload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card,
      },
    ],
  };
  const res = await fetchTeamsWebhook(webhookUrl, adaptivePayload);
  if (res.ok) return;

  const t = await res.text().catch(() => "");
  const retry =
    res.status === 400 || res.status === 406 || res.status === 415 || res.status === 422 || /card|adaptive|schema/i.test(t);
  if (retry) {
    await postTeamsMessageCard(webhookUrl, params.title, params.legacyText, params.facts);
    return;
  }
  throw new Error(`Teams webhook ${res.status}: ${t.slice(0, 200)}`);
}


export async function sendScheduleNotifications(
  broker: ServiceBroker,
  settings: MonitoringScheduleEntity,
  opts: { sitesChecked: number; reason: string }
): Promise<{ emailSent: boolean; teamsSent: boolean; skipped: boolean }> {
  const list = (await broker.call("alerting.alerts.list", {
    isResolved: false,
    limit: 500,
    offset: 0,
  })) as { items: Alert[] };
  const items = list.items ?? [];
  const critical = items.filter((a) => a.severity === "critical").length;
  const warning = items.filter((a) => a.severity === "warning").length;
  const openTotal = items.length;

  const siteList = (await broker.call("inventory.sites.list", {
    isActive: true,
    limit: 500,
    offset: 0,
  })) as { items: Site[] };
  const sites = siteList.items ?? [];
  const { expiryRows, opsOnlyRows } = buildExpiryEmailRowsFromSites(sites, items);
  const activeSitesCount = sites.filter((s) => s.isActive !== false).length;
  const expiryBuckets = countExpiryPanelBuckets(expiryRows);

  if (settings.notifyOn === "alerts_only" && openTotal === 0 && expiryRows.length === 0) {
    console.info(
      "[schedule-notify] Aviso omitido (correo y Teams): notifyOn=alerts_only y no hay alertas abiertas ni sitios en ventana de vencimiento del panel.",
    );
    return { emailSent: false, teamsSent: false, skipped: true };
  }
  const logoPath = resolvePurdyLogoPath();
  const useLogoCid = Boolean(logoPath);
  const payload: PurdyEmailBuildInput = {
    mode: "schedule",
    sitesChecked: opts.sitesChecked,
    activeSitesCount,
    reason: opts.reason,
    critical,
    warning,
    openTotal,
    expiryRows,
    opsOnlyRows,
    useLogoCid,
    invertEmailLogo: invertEmailLogoForPath(logoPath),
    publicAppUrl: publicAppUrl(),
    lastRunAt: settings.lastScheduledRunAt ?? null,
  };

  const subV = expiryRows.length ? `${expiryRows.length} vencimiento(s) panel` : null;
  const subject = `[Estado sitios Web Purdy] Chequeo programado · ${subV ? `${subV} · ` : ""}${openTotal} alerta(s)`;
  const html = buildPurdyNotificationHtml(payload);
  const textPlain = buildPurdyNotificationText(payload);

  const textLines = [
    `Sitios activos: ${activeSitesCount}.`,
    `Alertas abiertas: ${openTotal} (críticas: ${critical}, advertencias: ${warning}).`,
    `Vencen en menos de 5 días: ${expiryBuckets.lessThan5Days}.`,
    `Vencen en 5 a 10 días: ${expiryBuckets.fiveTo10Days}.`,
    "",
    `Chequeo automático completado (${opts.reason}).`,
    `Sitios revisados: ${opts.sitesChecked}.`,
    "",
    "Abra el inventario para ver el detalle.",
  ];
  const textBody = buildTeamsLegacyPlainText(textLines.join("\n"), expiryRows);
  const teamsIntro =
    expiryRows.length > 0
      ? "⚠️ Alertas de vencimiento de certificados y dominio: verifique la lista. Cuando renueve, actualice las fechas en el registro del sitio. ⚠️"
      : "Chequeo programado completado. No hay sitios en la ventana de vencimiento del panel.";

  const runAt = settings.lastScheduledRunAt;
  const facts = [
    { name: "Sitios activos", value: String(activeSitesCount) },
    { name: "Alertas abiertas", value: `${openTotal} (crít. ${critical} / adv. ${warning})` },
    { name: "< 5 días (panel)", value: String(expiryBuckets.lessThan5Days) },
    { name: "5–10 días (panel)", value: String(expiryBuckets.fiveTo10Days) },
    { name: "Motivo", value: opts.reason },
    { name: "Sitios revisados", value: String(opts.sitesChecked) },
    ...(runAt ? [{ name: "Ejecutado (servidor)", value: runAt.toISOString() }] : []),
  ];

  let emailSent = false;
  let teamsSent = false;

  const recipients = parseEmails(settings.notifyEmails ?? "");
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "noreply@localhost";

  const transport = smtpTransport();
  if (settings.notifyEmailEnabled !== false && transport && recipients.length > 0) {
    try {
      await transport.sendMail({
        from,
        to: recipients.join(", "),
        subject,
        text: textPlain,
        html,
        attachments: mailAttachments(logoPath),
      });
      emailSent = true;
    } catch (e) {
      console.error("[schedule-notify] SMTP:", e);
    }
  }

  const teamsUrl = settings.teamsWebhookUrl?.trim();
  if (settings.notifyTeamsEnabled && teamsUrl) {
    try {
      await postTeams(teamsUrl, {
        title: "Estado sitios Web Purdy — Chequeo programado",
        intro: teamsIntro,
        expiryRows,
        dashboard: {
          activeSites: activeSitesCount,
          openTotal,
          critical,
          warning,
          expiryRed: expiryBuckets.lessThan5Days,
          expiryOrange: expiryBuckets.fiveTo10Days,
        },
        facts,
        appUrl: publicAppUrl(),
        legacyText: textBody,
      });
      teamsSent = true;
    } catch (e) {
      console.error("[schedule-notify] Teams:", e);
    }
  }

  return { emailSent, teamsSent, skipped: false };
}

export async function sendTestNotifications(
  settings: {
    notifyEmails: string;
    teamsWebhookUrl: string | null;
    testEmail: boolean;
    testTeams: boolean;
  },
  broker?: ServiceBroker
): Promise<{ emailSent: boolean; teamsSent: boolean; errors: string[] }> {
  const errors: string[] = [];
  let emailSent = false;
  let teamsSent = false;

  if (!settings.testEmail && !settings.testTeams) {
    errors.push("Marque «Correo» o «Teams» para indicar qué desea probar.");
    return { emailSent, teamsSent, errors };
  }

  const recipients = parseEmails(settings.notifyEmails ?? "");
  const transport = smtpTransport();
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "noreply@localhost";

  let testExpiryRows: PurdySiteEmailRow[] = [];
  let testSitesChecked = 0;
  let testActiveSitesCount = 0;
  let testCritical = 0;
  let testWarning = 0;
  let testOpen = 0;
  let testBuckets = { lessThan5Days: 0, fiveTo10Days: 0 };
  if (broker && (settings.testEmail || settings.testTeams)) {
    try {
      const list = (await broker.call("alerting.alerts.list", {
        isResolved: false,
        limit: 100,
        offset: 0,
      })) as { items: Alert[] };
      const items = list.items ?? [];
      testOpen = items.length;
      testCritical = items.filter((a) => a.severity === "critical").length;
      testWarning = items.filter((a) => a.severity === "warning").length;
      const siteList = (await broker.call("inventory.sites.list", {
        isActive: true,
        limit: 500,
        offset: 0,
      })) as { items: Site[] };
      const sites = siteList.items ?? [];
      testSitesChecked = sites.length;
      testActiveSitesCount = sites.filter((s) => s.isActive !== false).length;
      const built = buildExpiryEmailRowsFromSites(sites, items);
      testExpiryRows = built.expiryRows;
      testBuckets = countExpiryPanelBuckets(testExpiryRows);
    } catch (e) {
      console.warn("[schedule-notify] Prueba: no se pudieron cargar alertas/sitios; se envía ejemplo con contadores en 0.", e);
    }
  }

  const logoPath = resolvePurdyLogoPath();
  const useLogoCid = Boolean(logoPath);

  if (settings.testEmail) {
    if (recipients.length === 0) {
      errors.push("Para probar correo, indique al menos un destinatario.");
    } else if (!transport) {
      errors.push(
        "SMTP no configurado (falta SMTP_HOST en el proceso del servidor). En producción defina las mismas variables que en .env local " +
          "(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM) en el panel de su proveedor (p. ej. Railway → Variables) y vuelva a desplegar.",
      );
    } else {
      try {
        const testPayload: PurdyEmailBuildInput = {
          mode: "test",
          sitesChecked: testSitesChecked,
          activeSitesCount: testActiveSitesCount,
          reason: "Envío desde panel",
          critical: testCritical,
          warning: testWarning,
          openTotal: testOpen,
          expiryRows: testExpiryRows,
          opsOnlyRows: [],
          useLogoCid,
          invertEmailLogo: invertEmailLogoForPath(logoPath),
          publicAppUrl: publicAppUrl(),
          lastRunAt: null,
        };
        await transport.sendMail({
          from,
          to: recipients.join(", "),
          subject: `[Estado sitios Web Purdy] Ejemplo · ${testExpiryRows.length ? `${testExpiryRows.length} venc. panel · ` : ""}${testOpen} alerta(s)`,
          text: buildPurdyNotificationText(testPayload),
          html: buildPurdyNotificationHtml(testPayload),
          attachments: mailAttachments(logoPath),
        });
        emailSent = true;
      } catch (e) {
        errors.push(formatSmtpOrNetworkError("Correo (SMTP)", e));
      }
    }
  }

  const teamsUrl = settings.teamsWebhookUrl?.trim();
  if (settings.testTeams) {
    if (!teamsUrl) {
      errors.push("Para probar Teams, pegue la URL del webhook entrante.");
    } else {
      try {
        const testIntro =
          "Ejemplo de notificación con el mismo formato que el aviso automático (vencimientos SSL/dominio).";
        const testHead = [
          `Sitios activos: ${testActiveSitesCount}.`,
          `Alertas abiertas: ${testOpen} (críticas: ${testCritical}, advertencias: ${testWarning}).`,
          `Vencen en menos de 5 días: ${testBuckets.lessThan5Days}.`,
          `Vencen en 5 a 10 días: ${testBuckets.fiveTo10Days}.`,
          "",
        ].join("\n");
        const testLegacy = buildTeamsLegacyPlainText(testHead + testIntro, testExpiryRows);
        await postTeams(teamsUrl, {
          title: "Estado sitios Web Purdy — Ejemplo",
          intro: testIntro,
          expiryRows: testExpiryRows,
          dashboard: {
            activeSites: testActiveSitesCount,
            openTotal: testOpen,
            critical: testCritical,
            warning: testWarning,
            expiryRed: testBuckets.lessThan5Days,
            expiryOrange: testBuckets.fiveTo10Days,
          },
          facts: [
            { name: "Sitios activos", value: String(testActiveSitesCount) },
            { name: "Alertas", value: `${testOpen} (crít. ${testCritical} / adv. ${testWarning})` },
            { name: "< 5 días", value: String(testBuckets.lessThan5Days) },
            { name: "5–10 días", value: String(testBuckets.fiveTo10Days) },
            { name: "Estado", value: "Ejemplo" },
          ],
          appUrl: publicAppUrl(),
          legacyText: testLegacy,
        });
        teamsSent = true;
      } catch (e) {
        errors.push(e instanceof Error ? `Teams: ${e.message}` : "Error Teams");
      }
    }
  }

  return { emailSent, teamsSent, errors };
}

export type ProximityRecoveryNotifierItem = {
  siteName: string;
  domain: string;
  prevSsl: Date | string | null;
  newSsl: Date | string | null;
  prevDom: Date | string | null;
  newDom: Date | string | null;
};

function coerceNotifierDate(d: Date | string | null | undefined): Date | null {
  if (d == null) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

/** Aviso positivo: sitio ya no está en ventana de proximidad tras chequeo diario (mismos canales que la programación). */
export async function sendProximityRecoveryNotifications(
  settings: MonitoringScheduleEntity,
  items: ProximityRecoveryNotifierItem[]
): Promise<{ emailSent: boolean; teamsSent: boolean }> {
  if (items.length === 0) return { emailSent: false, teamsSent: false };

  let emailSent = false;
  let teamsSent = false;

  const linesText: string[] = [];
  const linesHtml: string[] = [];
  for (const it of items) {
    const ps = fmtDateEs(coerceNotifierDate(it.prevSsl));
    const ns = fmtDateEs(coerceNotifierDate(it.newSsl));
    const pd = fmtDateEs(coerceNotifierDate(it.prevDom));
    const nd = fmtDateEs(coerceNotifierDate(it.newDom));
    linesText.push(
      `— ${it.siteName} (${it.domain})\n  SSL: ${ps} → ${ns}\n  Dominio: ${pd} → ${nd}`
    );
    linesHtml.push(
      `<tr><td style="padding:8px 10px;border-bottom:1px solid #243044;vertical-align:top;"><strong>${it.siteName}</strong><br/><span style="color:#8b9aab;font-size:12px;">${it.domain}</span></td><td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #243044;vertical-align:top;">SSL: ${ps} → <strong>${ns}</strong><br/>Dominio: ${pd} → <strong>${nd}</strong></td></tr>`
    );
  }

  const intro =
    "Tras el chequeo diario de sitios próximos a vencer (ventana del panel: ≤10 días o vencido), el certificado y/o el dominio ya no están en esa ventana. El inventario quedó actualizado con las fechas del último chequeo.";

  const subject = `[Estado sitios Web Purdy] Renovación detectada · ${items.length} sitio(s)`;
  const textBody = `${intro}\n\n${linesText.join("\n\n")}`;
  const htmlBody = `<p style="margin:0 0 14px 0;line-height:1.45;">${intro}</p><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${linesHtml.join("")}</table>`;

  const recipients = parseEmails(settings.notifyEmails ?? "");
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "noreply@localhost";
  const transport = smtpTransport();

  if (settings.notifyEmailEnabled !== false && transport && recipients.length > 0) {
    try {
      await transport.sendMail({
        from,
        to: recipients.join(", "),
        subject,
        text: textBody,
        html: htmlBody,
      });
      emailSent = true;
    } catch (e) {
      console.error("[schedule-notify] SMTP (renovación proximidad):", e);
    }
  }

  const teamsUrl = settings.teamsWebhookUrl?.trim();
  if (settings.notifyTeamsEnabled && teamsUrl) {
    try {
      const appBase = publicAppUrl();
      await postTeamsMessageCard(teamsUrl, "Renovación detectada — chequeo diario (proximidad)", `${intro}\n\n${linesText.join("\n\n")}`, [
        { name: "Sitios", value: String(items.length) },
        ...(appBase ? [{ name: "Inventario", value: appBase }] : []),
      ]);
      teamsSent = true;
    } catch (e) {
      console.error("[schedule-notify] Teams (renovación proximidad):", e);
    }
  }

  return { emailSent, teamsSent };
}

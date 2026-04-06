import fs from "node:fs";
import path from "node:path";
import type { ServiceBroker } from "moleculer";
import nodemailer from "nodemailer";
import type { Alert, AlertType, Site } from "@domain-slayer/domain";
import type { MonitoringScheduleEntity } from "@domain-slayer/infrastructure";
import {
  appendRowText,
  buildExpiryEmailRowsFromSites,
  buildPurdyNotificationHtml,
  buildPurdyNotificationText,
  fmtDateEs,
  LOGO_CID,
  alertTypeLabel,
  sortExpiryRowsByPanelUrgency,
  type PurdyEmailBuildInput,
  type PurdySiteEmailRow,
} from "./purdy-notification-email.js";

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
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    requireTLS: requireTls,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 20_000),
  });
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes("@"));
}

function resolvePurdyLogoPath(): string | null {
  const envPath = process.env.EMAIL_LOGO_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return path.resolve(envPath);
  const candidates = [
    path.join(process.cwd(), "apps", "frontend", "public", "grupo-purdy-logo.png"),
    path.join(process.cwd(), "public", "grupo-purdy-logo.png"),
    path.join(process.cwd(), "..", "frontend", "public", "grupo-purdy-logo.png"),
    path.join(process.cwd(), "assets", "email-logo.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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

/** Misma información que la tabla del correo (sitio, dominio, SSL, dominio, cómo resolver, avisos del panel). */
function buildTeamsAdaptiveCardContent(params: {
  title: string;
  intro: string;
  expiryRows: PurdySiteEmailRow[];
  opsOnlyRows: PurdySiteEmailRow[];
  facts: { name: string; value: string }[];
  appUrl: string | null;
}): Record<string, unknown> {
  const sorted = sortExpiryRowsByPanelUrgency(params.expiryRows);
  const body: Record<string, unknown>[] = [
    { type: "TextBlock", text: params.intro, wrap: true, weight: "Bolder", spacing: "None" },
    { type: "TextBlock", text: params.title, size: "Large", weight: "Bolder", spacing: "Medium" },
  ];

  if (sorted.length > 0) {
    body.push({
      type: "TextBlock",
      text: "1. Vencimientos (mismo criterio que el panel y el correo)",
      weight: "Bolder",
      size: "Default",
      color: "Accent",
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
      const other = r.alerts.filter((a) => !isSslFamily(a.alertType) && !isDomainFamily(a.alertType));
      if (other.length > 0) {
        const lines = other.map(
          (a) => `• [${a.severity}] ${alertTypeLabel(a.alertType)}: ${a.message}`
        );
        rowItems.push({
          type: "TextBlock",
          text: `Otras alertas en este sitio:\n${lines.join("\n")}`,
          wrap: true,
          size: "Small",
          isSubtle: true,
          spacing: "Small",
        });
      }
      body.push({
        type: "Container",
        style: "emphasis",
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

  if (params.opsOnlyRows.length > 0) {
    body.push({
      type: "TextBlock",
      text: "2. Otras alertas (fuera de la ventana del panel)",
      weight: "Bolder",
      size: "Default",
      color: "Accent",
      spacing: "Large",
      wrap: true,
    });
    for (const r of params.opsOnlyRows) {
      const lines = r.alerts.map(
        (a) => `• [${a.severity}] ${alertTypeLabel(a.alertType)}: ${a.message}`
      );
      body.push({
        type: "Container",
        style: "default",
        separator: true,
        spacing: "Small",
        items: [
          {
            type: "TextBlock",
            text: r.siteName,
            weight: "Bolder",
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
          {
            type: "TextBlock",
            text: lines.join("\n"),
            wrap: true,
            size: "Small",
            spacing: "Small",
          },
        ],
      });
    }
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
    body,
    ...(actions.length ? { actions } : {}),
  };
}

/** Texto plano del MessageCard de respaldo (misma estructura que el cuerpo en texto del correo). */
function buildTeamsLegacyPlainText(
  intro: string,
  expiryRows: PurdySiteEmailRow[],
  opsOnlyRows: PurdySiteEmailRow[]
): string {
  const lines = [intro, ""];
  if (expiryRows.length > 0) {
    lines.push("--- Vencimientos (criterio panel) ---");
    for (const r of sortExpiryRowsByPanelUrgency(expiryRows)) appendRowText(lines, r);
  }
  if (opsOnlyRows.length > 0) {
    lines.push("--- Otras alertas (fuera de ventana panel) ---");
    for (const r of opsOnlyRows) appendRowText(lines, r);
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
    themeColor: "152A4A",
    summary: title,
    title,
    text,
    sections: [{ facts }],
  };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    opsOnlyRows: PurdySiteEmailRow[];
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
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(adaptivePayload),
  });
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
    reason: opts.reason,
    critical,
    warning,
    openTotal,
    expiryRows,
    opsOnlyRows,
    useLogoCid,
    publicAppUrl: publicAppUrl(),
    lastRunAt: settings.lastScheduledRunAt ?? null,
  };

  const subV = expiryRows.length ? `${expiryRows.length} vencimiento(s) panel` : null;
  const subject = `[Estado sitios Web Purdy] Chequeo programado · ${subV ? `${subV} · ` : ""}${openTotal} alerta(s)`;
  const html = buildPurdyNotificationHtml(payload);
  const textPlain = buildPurdyNotificationText(payload);

  const textLines = [
    `Chequeo automático completado (${opts.reason}).`,
    `Sitios revisados: ${opts.sitesChecked}.`,
    `Alertas abiertas: ${openTotal} (críticas: ${critical}, advertencias: ${warning}).`,
    "",
    "Abra el inventario para ver el detalle.",
  ];
  const textBody = buildTeamsLegacyPlainText(textLines.join("\n"), expiryRows, opsOnlyRows);
  const teamsIntro =
    expiryRows.length > 0
      ? "⚠️ Alertas de vencimiento de certificados y dominio: verifique la lista. Cuando renueve, recuerde actualizarlo en el inventario. ⚠️"
      : "Chequeo programado completado. No hay sitios en la ventana de vencimiento del panel; revise alertas operativas o el inventario si aplica.";

  const runAt = settings.lastScheduledRunAt;
  const facts = [
    { name: "Motivo", value: opts.reason },
    { name: "Sitios revisados", value: String(opts.sitesChecked) },
    { name: "Vencimientos (panel)", value: String(expiryRows.length) },
    ...(runAt ? [{ name: "Ejecutado (servidor)", value: runAt.toISOString() }] : []),
    { name: "Alertas abiertas", value: String(openTotal) },
    { name: "Críticas", value: String(critical) },
    { name: "Advertencias", value: String(warning) },
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
        opsOnlyRows,
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
  let testOpsRows: PurdySiteEmailRow[] = [];
  let testCritical = 0;
  let testWarning = 0;
  let testOpen = 0;
  if (broker && (settings.testEmail || settings.testTeams)) {
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
    const built = buildExpiryEmailRowsFromSites(sites, items);
    testExpiryRows = built.expiryRows;
    testOpsRows = built.opsOnlyRows;
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
          sitesChecked: 0,
          reason: "Prueba manual",
          critical: testCritical,
          warning: testWarning,
          openTotal: testOpen,
          expiryRows: testExpiryRows,
          opsOnlyRows: testOpsRows,
          useLogoCid,
          publicAppUrl: publicAppUrl(),
          lastRunAt: null,
        };
        await transport.sendMail({
          from,
          to: recipients.join(", "),
          subject: `[Estado sitios Web Purdy] Prueba · ${testExpiryRows.length ? `${testExpiryRows.length} venc. panel · ` : ""}${testOpen} alerta(s)`,
          text: buildPurdyNotificationText(testPayload),
          html: buildPurdyNotificationHtml(testPayload),
          attachments: mailAttachments(logoPath),
        });
        emailSent = true;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Error SMTP");
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
          "Mensaje de prueba: tarjeta con sitio, dominio, fechas SSL/dominio y notas «cómo resolver», igual que el correo.";
        const testLegacy = buildTeamsLegacyPlainText(testIntro, testExpiryRows, testOpsRows);
        await postTeams(teamsUrl, {
          title: "Estado sitios Web Purdy — Prueba",
          intro: testIntro,
          expiryRows: testExpiryRows,
          opsOnlyRows: testOpsRows,
          facts: [{ name: "Estado", value: "OK (prueba)" }],
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

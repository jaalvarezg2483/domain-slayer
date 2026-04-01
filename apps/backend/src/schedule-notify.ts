import fs from "node:fs";
import path from "node:path";
import type { ServiceBroker } from "moleculer";
import nodemailer from "nodemailer";
import type { Alert, Site } from "@domain-slayer/domain";
import type { MonitoringScheduleEntity } from "@domain-slayer/infrastructure";
import {
  buildExpiryEmailRowsFromSites,
  buildPurdyNotificationHtml,
  buildPurdyNotificationText,
  LOGO_CID,
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

/** Teams Incoming Webhook (Office 365 connector). */
async function postTeams(webhookUrl: string, title: string, text: string, facts: { name: string; value: string }[]) {
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

function teamsTextWithSites(base: string, rows: PurdySiteEmailRow[]): string {
  if (rows.length === 0) return base;
  const siteLines = rows.map((r) => `• ${r.siteName} (${r.domain})`);
  return `${base}\n\nSitios con alertas:\n${siteLines.join("\n")}`;
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
  const textBody = teamsTextWithSites(textLines.join("\n"), [...expiryRows, ...opsOnlyRows]);

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
      await postTeams(teamsUrl, "Estado sitios Web Purdy — Chequeo programado", textBody, facts);
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
      errors.push("SMTP no configurado (SMTP_HOST en el servidor).");
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
        await postTeams(
          teamsUrl,
          "Estado sitios Web Purdy — Prueba",
          teamsTextWithSites(
            "Mensaje de prueba: el webhook de Teams recibe correctamente las alertas del chequeo programado.",
            [...testExpiryRows, ...testOpsRows]
          ),
          [{ name: "Estado", value: "OK" }]
        );
        teamsSent = true;
      } catch (e) {
        errors.push(e instanceof Error ? `Teams: ${e.message}` : "Error Teams");
      }
    }
  }

  return { emailSent, teamsSent, errors };
}

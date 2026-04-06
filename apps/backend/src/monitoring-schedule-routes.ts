import cron from "node-cron";
import type { Application } from "express";
import type { DataSource } from "typeorm";
import type { ServiceBroker } from "moleculer";
import { SqlMonitoringScheduleRepository, type MonitoringScheduleEntity } from "@domain-slayer/infrastructure";
import { sendTestNotifications } from "./schedule-notify.js";

const SCHED_PATHS: string[] = ["/api/settings/monitoring-schedule", "/api/settings/monitoring-schedule/"];

function scheduleToDto(e: MonitoringScheduleEntity) {
  const intervalDays = e.intervalDays != null && !Number.isNaN(Number(e.intervalDays)) ? Number(e.intervalDays) : 15;
  const runMinute =
    e.runMinute != null && !Number.isNaN(Number(e.runMinute))
      ? Math.min(59, Math.max(0, Math.floor(Number(e.runMinute))))
      : 0;
  const cronAlternateWeeks = Boolean(e.cronAlternateWeeks);
  const isoWeekParity =
    e.isoWeekParity === 0 || e.isoWeekParity === 1 ? Number(e.isoWeekParity) : null;
  const cronFirstWeekOnly = Boolean(e.cronFirstWeekOnly);
  return {
    enabled: e.enabled,
    scheduleMode: e.scheduleMode,
    cronExpression: e.cronExpression,
    intervalDays,
    runHour: e.runHour,
    runMinute,
    cronAlternateWeeks,
    isoWeekParity: cronAlternateWeeks ? (isoWeekParity ?? 0) : isoWeekParity,
    cronFirstWeekOnly,
    notifyEmails: e.notifyEmails,
    teamsWebhookUrl: e.teamsWebhookUrl,
    notifyEmailEnabled: e.notifyEmailEnabled !== false,
    notifyTeamsEnabled: Boolean(e.notifyTeamsEnabled),
    notifyOn: e.notifyOn,
    lastScheduledRunAt: e.lastScheduledRunAt ? e.lastScheduledRunAt.toISOString() : null,
    proximityDailyEnabled: Boolean(e.proximityDailyEnabled),
    proximityRunHour:
      e.proximityRunHour != null && !Number.isNaN(Number(e.proximityRunHour))
        ? Math.min(23, Math.max(0, Math.floor(Number(e.proximityRunHour))))
        : 7,
    lastProximityDailyRunAt: e.lastProximityDailyRunAt ? e.lastProximityDailyRunAt.toISOString() : null,
    updatedAt: e.updatedAt.toISOString(),
  };
}

/**
 * Registra GET/PUT/POST en la app Express con ruta absoluta `/api/settings/...`.
 * Así no depende de routers anidados ni del orden bajo `app.use("/api", …)`.
 */
export function registerMonitoringScheduleHttp(
  app: Application,
  ds: DataSource,
  onScheduleChanged?: () => void,
  broker?: ServiceBroker
): void {
  const schedRepo = new SqlMonitoringScheduleRepository(ds.manager);

  app.get(SCHED_PATHS, async (_req, res, next) => {
    try {
      const row = await schedRepo.getOrCreate();
      res.json(scheduleToDto(row));
    } catch (e) {
      next(e);
    }
  });

  app.put(SCHED_PATHS, async (req, res, next) => {
    try {
      const b = req.body as Record<string, unknown>;
      const row = await schedRepo.getOrCreate();
      if (typeof b.enabled === "boolean") row.enabled = b.enabled;
      if (b.scheduleMode === "cron" || b.scheduleMode === "interval") row.scheduleMode = b.scheduleMode;
      if (typeof b.cronExpression === "string") row.cronExpression = b.cronExpression.trim().slice(0, 120);
      if (b.intervalDays === null || b.intervalDays === undefined) {
        /* keep */
      } else {
        const n = Number(b.intervalDays);
        if (!Number.isNaN(n)) row.intervalDays = Math.min(365, Math.max(1, n));
      }
      if (b.runHour !== undefined && b.runHour !== null) {
        const rh = Number(b.runHour);
        if (!Number.isNaN(rh)) row.runHour = Math.min(23, Math.max(0, Math.floor(rh)));
      }
      if (b.runMinute !== undefined && b.runMinute !== null) {
        const rm = Number(b.runMinute);
        if (!Number.isNaN(rm)) row.runMinute = Math.min(59, Math.max(0, Math.floor(rm)));
      }
      if (typeof b.cronAlternateWeeks === "boolean") {
        row.cronAlternateWeeks = b.cronAlternateWeeks;
        if (!b.cronAlternateWeeks) row.isoWeekParity = null;
      }
      if (row.cronAlternateWeeks) {
        if (b.isoWeekParity !== undefined && b.isoWeekParity !== null) {
          const p = Number(b.isoWeekParity);
          if (!Number.isNaN(p)) row.isoWeekParity = p === 1 ? 1 : 0;
        }
        if (row.isoWeekParity !== 0 && row.isoWeekParity !== 1) row.isoWeekParity = 0;
      }
      if (typeof b.cronFirstWeekOnly === "boolean") row.cronFirstWeekOnly = b.cronFirstWeekOnly;
      if (typeof b.notifyEmails === "string") row.notifyEmails = b.notifyEmails.slice(0, 8000);
      if (b.teamsWebhookUrl === null || b.teamsWebhookUrl === "") row.teamsWebhookUrl = null;
      else if (typeof b.teamsWebhookUrl === "string") row.teamsWebhookUrl = b.teamsWebhookUrl.trim().slice(0, 2048);
      if (typeof b.notifyEmailEnabled === "boolean") row.notifyEmailEnabled = b.notifyEmailEnabled;
      if (typeof b.notifyTeamsEnabled === "boolean") row.notifyTeamsEnabled = b.notifyTeamsEnabled;
      if (b.notifyOn === "always" || b.notifyOn === "alerts_only") row.notifyOn = b.notifyOn;
      if (typeof b.proximityDailyEnabled === "boolean") row.proximityDailyEnabled = b.proximityDailyEnabled;
      if (b.proximityRunHour !== undefined && b.proximityRunHour !== null) {
        const ph = Number(b.proximityRunHour);
        if (!Number.isNaN(ph)) row.proximityRunHour = Math.min(23, Math.max(0, Math.floor(ph)));
      }
      if (row.scheduleMode === "cron" && !cron.validate(row.cronExpression ?? "")) {
        res.status(422).json({ error: "Expresión cron no válida (5 campos: min hora día mes día-semana)." });
        return;
      }
      await schedRepo.save(row);
      onScheduleChanged?.();
      res.json(scheduleToDto(row));
    } catch (e) {
      next(e);
    }
  });

  const testPaths: string[] = [
    "/api/settings/monitoring-schedule/test-notify",
    "/api/settings/monitoring-schedule/test-notify/",
  ];

  app.post(testPaths, async (req, res, next) => {
    try {
      const b = req.body as {
        notifyEmails?: string;
        teamsWebhookUrl?: string | null;
        testEmail?: boolean;
        testTeams?: boolean;
      };
      const r0 = await sendTestNotifications(
        {
          notifyEmails: typeof b.notifyEmails === "string" ? b.notifyEmails : "",
          teamsWebhookUrl: b.teamsWebhookUrl ?? null,
          testEmail: b.testEmail === true,
          testTeams: b.testTeams === true,
        },
        broker
      );
      if (r0.errors.length && !r0.emailSent && !r0.teamsSent) {
        res.status(422).json({
          ...r0,
          error: r0.errors.join(" · ") || "No se pudo enviar la prueba.",
        });
        return;
      }
      res.json(r0);
    } catch (e) {
      next(e);
    }
  });
}

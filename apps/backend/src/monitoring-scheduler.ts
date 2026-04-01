import cron from "node-cron";
import type { DataSource } from "typeorm";
import type { ServiceBroker } from "moleculer";
import type { Logger } from "@domain-slayer/shared";
import { SqlMonitoringScheduleRepository } from "@domain-slayer/infrastructure";
import { getISOWeekLocal } from "./iso-week.js";
import { sendScheduleNotifications } from "./schedule-notify.js";

export function createMonitoringScheduler(broker: ServiceBroker, ds: DataSource, log: Logger) {
  const repo = new SqlMonitoringScheduleRepository(ds.manager);
  const tasks: cron.ScheduledTask[] = [];

  function stopAll() {
    while (tasks.length) {
      const t = tasks.pop();
      t?.stop();
    }
  }

  async function executeRun(source: "cron" | "interval") {
    const row = await repo.getOrCreate();
    if (!row.enabled) return;
    if (source === "cron" && row.scheduleMode !== "cron") return;
    if (source === "interval" && row.scheduleMode !== "interval") return;

    try {
      const out = (await broker.call("monitoring.check.runAll")) as { count?: number };
      const sitesChecked = typeof out?.count === "number" ? out.count : 0;
      row.lastScheduledRunAt = new Date();
      await repo.save(row);
      await sendScheduleNotifications(broker, row, {
        sitesChecked,
        reason: source === "cron" ? "Programación cron" : `Cada ${row.intervalDays ?? 15} día(s)`,
      });
      log.info({ sitesChecked, source }, "Chequeo programado terminado");
    } catch (e) {
      log.error(
        { err: e instanceof Error ? e.message : String(e) },
        "Chequeo programado falló"
      );
    }
  }

  async function onIntervalTick() {
    const row = await repo.getOrCreate();
    if (!row.enabled || row.scheduleMode !== "interval") return;
    const days = Math.min(365, Math.max(1, row.intervalDays ?? 15));
    const last = row.lastScheduledRunAt;
    if (last) {
      const diffDays = (Date.now() - last.getTime()) / 86_400_000;
      if (diffDays < days) return;
    }
    await executeRun("interval");
  }

  function reschedule() {
    stopAll();
    void (async () => {
      const row = await repo.getOrCreate();
      if (!row.enabled) {
        log.info("Programación de chequeo: desactivada");
        return;
      }
      if (row.scheduleMode === "cron") {
        const expr = (row.cronExpression ?? "0 6 * * *").trim();
        if (!cron.validate(expr)) {
          log.warn({ expr }, "Expresión cron inválida; corrija en Ajustes → Programación");
          return;
        }
        tasks.push(
          cron.schedule(expr, () => {
            void (async () => {
              const cur = await repo.getOrCreate();
              if (!cur.enabled || cur.scheduleMode !== "cron") return;
              if (cur.cronAlternateWeeks) {
                const w = getISOWeekLocal(new Date());
                const parity = cur.isoWeekParity === 1 ? 1 : 0;
                if (w % 2 !== parity) return;
              }
              if (cur.cronFirstWeekOnly) {
                const dom = new Date().getDate();
                if (dom < 1 || dom > 7) return;
              }
              await executeRun("cron");
            })();
          })
        );
        log.info({ expr, biweeklyIso: Boolean(row.cronAlternateWeeks) }, "Chequeo automático activo (cron)");
        return;
      }
      const h = Math.min(23, Math.max(0, row.runHour ?? 6));
      const m = Math.min(59, Math.max(0, row.runMinute ?? 0));
      tasks.push(
        cron.schedule(`${m} ${h} * * *`, () => {
          void onIntervalTick();
        })
      );
      log.info({ runHour: h, intervalDays: row.intervalDays }, "Chequeo automático activo (cada N días)");
    })();
  }

  reschedule();

  return { reschedule };
}

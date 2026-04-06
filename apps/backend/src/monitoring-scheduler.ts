import cron from "node-cron";
import type { DataSource } from "typeorm";
import type { ServiceBroker } from "moleculer";
import type { Site } from "@domain-slayer/domain";
import { siteInPanelExpiryProximityWindow, type Logger } from "@domain-slayer/shared";
import { SqlMonitoringScheduleRepository } from "@domain-slayer/infrastructure";
import { getISOWeekLocal } from "./iso-week.js";
import {
  sendProximityRecoveryNotifications,
  sendScheduleNotifications,
  type ProximityRecoveryNotifierItem,
} from "./schedule-notify.js";

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

  /** Solo sitios en ventana del panel (≤10 días / vencido); actualiza BD y avisa si salieron de la ventana. */
  async function executeProximityDaily() {
    const row = await repo.getOrCreate();
    if (!row.proximityDailyEnabled) return;

    const now = new Date();
    try {
      const siteList = (await broker.call("inventory.sites.list", {
        isActive: true,
        limit: 500,
        offset: 0,
      })) as { items: Site[] };
      const items = siteList.items ?? [];
      const targets = items.filter((s) => siteInPanelExpiryProximityWindow(s, now));

      type Snap = {
        siteName: string;
        domain: string;
        prevSsl: Site["sslValidToFinal"];
        prevDom: Site["domainExpiryFinal"];
      };
      const snaps = new Map<string, Snap>();
      for (const s of targets) {
        snaps.set(s.id, {
          siteName: s.siteName,
          domain: s.domain,
          prevSsl: s.sslValidToFinal ?? s.sslValidTo,
          prevDom: s.domainExpiryFinal,
        });
      }

      for (const s of targets) {
        try {
          await broker.call("monitoring.check.runOne", { siteId: s.id });
        } catch (e) {
          log.warn(
            { siteId: s.id, err: e instanceof Error ? e.message : String(e) },
            "Chequeo diario proximidad: fallo en sitio"
          );
        }
      }

      const recovered: ProximityRecoveryNotifierItem[] = [];
      for (const [id, snap] of snaps) {
        try {
          const after = (await broker.call("inventory.sites.get", { id })) as Site & {
            linkedDocuments?: unknown;
          };
          const { linkedDocuments: _ld, ...siteAfter } = after;
          if (!siteInPanelExpiryProximityWindow(siteAfter, new Date())) {
            recovered.push({
              siteName: snap.siteName,
              domain: snap.domain,
              prevSsl: snap.prevSsl,
              newSsl: siteAfter.sslValidToFinal ?? siteAfter.sslValidTo,
              prevDom: snap.prevDom,
              newDom: siteAfter.domainExpiryFinal,
            });
          }
        } catch (e) {
          log.warn(
            { siteId: id, err: e instanceof Error ? e.message : String(e) },
            "Chequeo diario proximidad: no se pudo releer sitio"
          );
        }
      }

      row.lastProximityDailyRunAt = new Date();
      await repo.save(row);

      if (recovered.length > 0) {
        await sendProximityRecoveryNotifications(row, recovered);
      }

      log.info(
        { checked: targets.length, recovered: recovered.length },
        "Chequeo diario (próximos a vencer) terminado"
      );
    } catch (e) {
      log.error(
        { err: e instanceof Error ? e.message : String(e) },
        "Chequeo diario (próximos a vencer) falló"
      );
    }
  }

  function reschedule() {
    stopAll();
    void (async () => {
      const row = await repo.getOrCreate();
      if (!row.enabled && !row.proximityDailyEnabled) {
        log.info("Programación de chequeo: desactivada (global y diaria proximidad)");
        return;
      }
      if (row.enabled) {
        if (row.scheduleMode === "cron") {
          const expr = (row.cronExpression ?? "0 6 * * *").trim();
          if (!cron.validate(expr)) {
            log.warn({ expr }, "Expresión cron inválida; corrija en Ajustes → Programación");
          } else {
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
          }
        } else {
          const h = Math.min(23, Math.max(0, row.runHour ?? 6));
          const m = Math.min(59, Math.max(0, row.runMinute ?? 0));
          tasks.push(
            cron.schedule(`${m} ${h} * * *`, () => {
              void onIntervalTick();
            })
          );
          log.info({ runHour: h, intervalDays: row.intervalDays }, "Chequeo automático activo (cada N días)");
        }
      }

      if (row.proximityDailyEnabled) {
        const ph = Math.min(23, Math.max(0, row.proximityRunHour ?? 7));
        tasks.push(
          cron.schedule(`0 ${ph} * * *`, () => {
            void (async () => {
              const cur = await repo.getOrCreate();
              if (!cur.proximityDailyEnabled) return;
              await executeProximityDaily();
            })();
          })
        );
        log.info({ proximityRunHour: ph }, "Chequeo diario (solo próximos a vencer) activo");
      }
    })();
  }

  reschedule();

  return { reschedule };
}

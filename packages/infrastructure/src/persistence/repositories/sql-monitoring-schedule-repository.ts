import type { EntityManager } from "typeorm";
import { MonitoringScheduleEntity } from "../entities/monitoring-schedule.entity.js";

const DEFAULT_ID = "default";

export class SqlMonitoringScheduleRepository {
  constructor(private readonly manager: EntityManager) {}

  async getOrCreate(): Promise<MonitoringScheduleEntity> {
    let row = await this.manager.findOne(MonitoringScheduleEntity, { where: { id: DEFAULT_ID } });
    if (!row) {
      row = this.manager.create(MonitoringScheduleEntity, {
        id: DEFAULT_ID,
        enabled: false,
        scheduleMode: "cron",
        cronExpression: "0 6 * * *",
        intervalDays: 15,
        runHour: 6,
        runMinute: 0,
        cronAlternateWeeks: false,
        isoWeekParity: null,
        cronFirstWeekOnly: false,
        notifyEmails: "",
        teamsWebhookUrl: null,
        notifyEmailEnabled: true,
        notifyTeamsEnabled: false,
        notifyOn: "always",
        lastScheduledRunAt: null,
        updatedAt: new Date(),
      });
      await this.manager.save(row);
    }
    return row;
  }

  async save(entity: MonitoringScheduleEntity): Promise<void> {
    entity.updatedAt = new Date();
    await this.manager.save(entity);
  }
}

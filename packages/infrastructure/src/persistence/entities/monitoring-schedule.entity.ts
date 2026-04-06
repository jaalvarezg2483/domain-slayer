import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "monitoring_schedule" })
export class MonitoringScheduleEntity {
  @PrimaryColumn({ type: "varchar", length: 36 })
  id!: string;

  @Column({ type: "boolean", default: false })
  enabled!: boolean;

  /** "cron" | "interval" */
  @Column({ name: "schedule_mode", type: "varchar", length: 20, default: "cron" })
  scheduleMode!: string;

  @Column({ name: "cron_expression", type: "varchar", length: 120, default: "0 6 * * *" })
  cronExpression!: string;

  @Column({ name: "interval_days", type: "int", nullable: true })
  intervalDays!: number | null;

  /** Hora local del servidor (0–23) */
  @Column({ name: "run_hour", type: "int", default: 6 })
  runHour!: number;

  /** Minuto (0–59); en modo intervalo se usa en la expresión cron diaria que dispara el tick */
  @Column({ name: "run_minute", type: "int", default: 0 })
  runMinute!: number;

  /**
   * Si true y scheduleMode es cron: tras coincidir la expresión, solo ejecuta en semanas ISO
   * cuyo número tiene la paridad de `isoWeekParity` (0 = par, 1 = impar).
   */
  @Column({ name: "cron_alternate_weeks", type: "boolean", default: false })
  cronAlternateWeeks!: boolean;

  @Column({ name: "iso_week_parity", type: "int", nullable: true })
  isoWeekParity!: number | null;

  /**
   * Si true y scheduleMode es cron: tras coincidir dow/hora, solo ejecuta si el día del mes es 1–7
   * (primer «lunes/martes/…» del mes en la práctica).
   */
  @Column({ name: "cron_first_week_only", type: "boolean", default: false })
  cronFirstWeekOnly!: boolean;

  @Column({ name: "notify_emails", type: "text", default: "" })
  notifyEmails!: string;

  @Column({ name: "teams_webhook_url", type: "varchar", length: 2048, nullable: true })
  teamsWebhookUrl!: string | null;

  @Column({ name: "notify_email_enabled", type: "boolean", default: true })
  notifyEmailEnabled!: boolean;

  @Column({ name: "notify_teams_enabled", type: "boolean", default: false })
  notifyTeamsEnabled!: boolean;

  /** "always" | "alerts_only" */
  @Column({ name: "notify_on", type: "varchar", length: 20, default: "always" })
  notifyOn!: string;

  @Column({ name: "last_scheduled_run_at", type: "datetime", nullable: true })
  lastScheduledRunAt!: Date | null;

  /**
   * Chequeo diario solo en sitios con SSL/dominio en ventana del panel (≤10 días o vencido).
   * Independiente de `enabled` del chequeo global.
   */
  @Column({ name: "proximity_daily_enabled", type: "boolean", default: false })
  proximityDailyEnabled!: boolean;

  /** Hora local del servidor (0–23) para el cron diario de proximidad. */
  @Column({ name: "proximity_run_hour", type: "int", default: 7 })
  proximityRunHour!: number;

  @Column({ name: "last_proximity_daily_run_at", type: "datetime", nullable: true })
  lastProximityDailyRunAt!: Date | null;

  @Column({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}

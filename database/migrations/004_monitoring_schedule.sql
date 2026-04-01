/* Programación de chequeos y notificaciones (SQL Server). Ejecutar tras 001–003 si no usa DB_SYNC. */
IF OBJECT_ID(N'dbo.monitoring_schedule', N'U') IS NOT NULL DROP TABLE dbo.monitoring_schedule;
GO

CREATE TABLE dbo.monitoring_schedule (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  enabled BIT NOT NULL CONSTRAINT DF_ms_enabled DEFAULT (0),
  schedule_mode VARCHAR(20) NOT NULL CONSTRAINT DF_ms_mode DEFAULT ('cron'),
  cron_expression VARCHAR(120) NOT NULL CONSTRAINT DF_ms_cron DEFAULT ('0 6 * * *'),
  interval_days INT NULL,
  run_hour INT NOT NULL CONSTRAINT DF_ms_run_hour DEFAULT (6),
  notify_emails NVARCHAR(MAX) NOT NULL CONSTRAINT DF_ms_emails DEFAULT (N''),
  teams_webhook_url NVARCHAR(2048) NULL,
  notify_on VARCHAR(20) NOT NULL CONSTRAINT DF_ms_notify DEFAULT ('always'),
  last_scheduled_run_at DATETIME2 NULL,
  updated_at DATETIME2 NOT NULL
);
GO

INSERT INTO dbo.monitoring_schedule (id, enabled, schedule_mode, cron_expression, interval_days, run_hour, notify_emails, teams_webhook_url, notify_on, last_scheduled_run_at, updated_at)
VALUES (N'default', 0, N'cron', N'0 6 * * *', 15, 6, N'', NULL, N'always', NULL, SYSUTCDATETIME());
GO

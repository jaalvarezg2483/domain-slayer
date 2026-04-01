/* Minutos de ejecución y bisemanal por semana ISO (cron + filtro). Ejecutar en SQL Server si no usa DB_SYNC. */
IF COL_LENGTH(N'dbo.monitoring_schedule', N'run_minute') IS NULL
BEGIN
  ALTER TABLE dbo.monitoring_schedule ADD run_minute INT NOT NULL CONSTRAINT DF_ms_run_minute DEFAULT (0);
END
GO

IF COL_LENGTH(N'dbo.monitoring_schedule', N'cron_alternate_weeks') IS NULL
BEGIN
  ALTER TABLE dbo.monitoring_schedule ADD cron_alternate_weeks BIT NOT NULL CONSTRAINT DF_ms_cron_alt_weeks DEFAULT (0);
END
GO

IF COL_LENGTH(N'dbo.monitoring_schedule', N'iso_week_parity') IS NULL
BEGIN
  ALTER TABLE dbo.monitoring_schedule ADD iso_week_parity TINYINT NULL;
END
GO

IF COL_LENGTH(N'dbo.monitoring_schedule', N'cron_first_week_only') IS NULL
BEGIN
  ALTER TABLE dbo.monitoring_schedule ADD cron_first_week_only BIT NOT NULL CONSTRAINT DF_ms_cron_first_wk DEFAULT (0);
END
GO

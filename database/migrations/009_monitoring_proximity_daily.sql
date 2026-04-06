/* Chequeo diario solo sitios próximos a vencer (panel). Ejecutar si no usa DB_SYNC. */
IF COL_LENGTH(N'dbo.monitoring_schedule', N'proximity_daily_enabled') IS NULL
  ALTER TABLE dbo.monitoring_schedule ADD proximity_daily_enabled BIT NOT NULL CONSTRAINT DF_ms_prox_daily DEFAULT (0);

IF COL_LENGTH(N'dbo.monitoring_schedule', N'proximity_run_hour') IS NULL
  ALTER TABLE dbo.monitoring_schedule ADD proximity_run_hour INT NOT NULL CONSTRAINT DF_ms_prox_hour DEFAULT (7);

IF COL_LENGTH(N'dbo.monitoring_schedule', N'last_proximity_daily_run_at') IS NULL
  ALTER TABLE dbo.monitoring_schedule ADD last_proximity_daily_run_at DATETIME2 NULL;
GO

/* Habilitar correo / Teams por separado (SQL Server). */
IF COL_LENGTH(N'dbo.monitoring_schedule', N'notify_email_enabled') IS NULL
  ALTER TABLE dbo.monitoring_schedule ADD notify_email_enabled BIT NOT NULL CONSTRAINT DF_ms_notify_email DEFAULT (1);
GO
IF COL_LENGTH(N'dbo.monitoring_schedule', N'notify_teams_enabled') IS NULL
  ALTER TABLE dbo.monitoring_schedule ADD notify_teams_enabled BIT NOT NULL CONSTRAINT DF_ms_notify_teams DEFAULT (0);
GO

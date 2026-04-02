/* Fecha SSL manual + fecha efectiva (SQL Server). Ejecutar si DB_SYNC=false. */
IF COL_LENGTH('dbo.sites', 'ssl_valid_to_manual') IS NULL
  ALTER TABLE dbo.sites ADD ssl_valid_to_manual DATETIME2 NULL;
IF COL_LENGTH('dbo.sites', 'ssl_expiry_source') IS NULL
  ALTER TABLE dbo.sites ADD ssl_expiry_source VARCHAR(20) NOT NULL CONSTRAINT DF_sites_ssl_expiry_source DEFAULT 'unavailable';
IF COL_LENGTH('dbo.sites', 'ssl_valid_to_final') IS NULL
  ALTER TABLE dbo.sites ADD ssl_valid_to_final DATETIME2 NULL;
GO
UPDATE dbo.sites SET ssl_expiry_source = 'unavailable' WHERE ssl_expiry_source IS NULL OR ssl_expiry_source = '';
UPDATE dbo.sites SET ssl_valid_to_final = ssl_valid_to WHERE ssl_valid_to IS NOT NULL AND ssl_valid_to_final IS NULL;
UPDATE dbo.sites SET ssl_expiry_source = 'auto' WHERE ssl_valid_to IS NOT NULL AND ssl_expiry_source = 'unavailable';
GO

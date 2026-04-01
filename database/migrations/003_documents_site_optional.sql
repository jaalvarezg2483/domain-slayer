/* Documentos pueden existir sin sitio (biblioteca global / Excel compartido). */
IF COL_LENGTH(N'dbo.documents', N'site_id') IS NOT NULL
BEGIN
  ALTER TABLE dbo.documents ALTER COLUMN site_id VARCHAR(36) NULL;
END
GO

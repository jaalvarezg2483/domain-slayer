/* Texto indexable para búsqueda en biblioteca de documentos (SQL Server / Azure SQL). */

IF COL_LENGTH(N'dbo.documents', N'search_text') IS NULL

BEGIN

  ALTER TABLE dbo.documents ADD search_text NVARCHAR(MAX) NULL;

END

GO



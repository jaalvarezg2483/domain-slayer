-- Notas operativas por SSL / dominio y vínculos sitio ↔ documento de biblioteca (N:N).

IF COL_LENGTH('dbo.sites', 'ssl_resolution_notes') IS NULL
  ALTER TABLE dbo.sites ADD ssl_resolution_notes NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.sites', 'domain_resolution_notes') IS NULL
  ALTER TABLE dbo.sites ADD domain_resolution_notes NVARCHAR(MAX) NULL;
GO

IF OBJECT_ID('dbo.site_document_links', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.site_document_links (
    site_id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    CONSTRAINT PK_site_document_links PRIMARY KEY (site_id, document_id),
    CONSTRAINT FK_sdl_site FOREIGN KEY (site_id) REFERENCES dbo.sites(id) ON DELETE CASCADE,
    CONSTRAINT FK_sdl_document FOREIGN KEY (document_id) REFERENCES dbo.documents(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_site_document_links_document ON dbo.site_document_links(document_id);
END
GO

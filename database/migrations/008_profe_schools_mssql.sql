-- Inventario Profe: instituciones por usuario (JWT sub). Ejecutar en SQL Server si no usa sincronización TypeORM.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'profe_schools' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.profe_schools (
    id VARCHAR(36) NOT NULL CONSTRAINT PK_profe_schools PRIMARY KEY,
    owner_user_id VARCHAR(36) NOT NULL,
    name NVARCHAR(500) NOT NULL,
    logo_path NVARCHAR(MAX) NULL,
    report_header NVARCHAR(MAX) NULL,
    report_footer NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL,
    updated_at DATETIME2 NOT NULL
  );
  CREATE INDEX IX_profe_schools_owner ON dbo.profe_schools (owner_user_id);
END
GO

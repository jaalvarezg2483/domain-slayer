-- Usuarios de la aplicación (login JWT). Ejecutar en Azure SQL / SQL Server si no arranca el backend con auto-ensure.

IF OBJECT_ID('dbo.app_users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    email NVARCHAR(320) NOT NULL,
    password_hash NVARCHAR(512) NOT NULL,
    created_at DATETIME2 NOT NULL,
    CONSTRAINT UQ_app_users_email UNIQUE (email)
  );
END
GO

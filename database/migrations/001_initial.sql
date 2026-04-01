/* Domain Slayer — SQL Server / Azure SQL (producción).
   Desarrollo local: usar DB_TYPE=sqlite (TypeORM crea tablas con synchronize; no requiere este script). */
IF OBJECT_ID(N'dbo.documents', N'U') IS NOT NULL DROP TABLE dbo.documents;
IF OBJECT_ID(N'dbo.check_history', N'U') IS NOT NULL DROP TABLE dbo.check_history;
IF OBJECT_ID(N'dbo.alerts', N'U') IS NOT NULL DROP TABLE dbo.alerts;
IF OBJECT_ID(N'dbo.sites', N'U') IS NOT NULL DROP TABLE dbo.sites;
GO

CREATE TABLE dbo.sites (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  site_name NVARCHAR(500) NOT NULL,
  business_unit NVARCHAR(200) NULL,
  domain NVARCHAR(253) NOT NULL,
  url NVARCHAR(2048) NOT NULL,
  environment VARCHAR(20) NOT NULL,
  provider NVARCHAR(200) NULL,
  hosting_provider NVARCHAR(200) NULL,
  dns_provider NVARCHAR(200) NULL,
  ssl_provider NVARCHAR(200) NULL,
  registrar_provider NVARCHAR(200) NULL,
  owner NVARCHAR(200) NULL,
  technical_owner NVARCHAR(200) NULL,
  contact_email NVARCHAR(320) NULL,
  notes NVARCHAR(MAX) NULL,
  is_active BIT NOT NULL CONSTRAINT DF_sites_is_active DEFAULT (1),
  created_at DATETIME2 NOT NULL,
  updated_at DATETIME2 NOT NULL,

  domain_expiry_auto DATETIME2 NULL,
  domain_expiry_manual DATETIME2 NULL,
  domain_expiry_final DATETIME2 NULL,
  domain_expiry_source VARCHAR(20) NOT NULL CONSTRAINT DF_sites_domain_expiry_source DEFAULT ('unavailable'),
  domain_expiry_status VARCHAR(20) NOT NULL CONSTRAINT DF_sites_domain_expiry_status DEFAULT ('unknown'),
  domain_status VARCHAR(20) NOT NULL CONSTRAINT DF_sites_domain_status DEFAULT ('unknown'),

  dns_status VARCHAR(20) NOT NULL CONSTRAINT DF_sites_dns_status DEFAULT ('unknown'),
  nameservers_json NVARCHAR(MAX) NULL,
  a_records_json NVARCHAR(MAX) NULL,
  aaaa_records_json NVARCHAR(MAX) NULL,
  cname_records_json NVARCHAR(MAX) NULL,
  mx_records_json NVARCHAR(MAX) NULL,
  soa_record_json NVARCHAR(MAX) NULL,

  http_status VARCHAR(20) NOT NULL CONSTRAINT DF_sites_http_status DEFAULT ('unknown'),
  https_status VARCHAR(20) NOT NULL CONSTRAINT DF_sites_https_status DEFAULT ('unknown'),

  ssl_subject NVARCHAR(2000) NULL,
  ssl_issuer NVARCHAR(2000) NULL,
  ssl_valid_from DATETIME2 NULL,
  ssl_valid_to DATETIME2 NULL,
  ssl_serial_number NVARCHAR(256) NULL,
  ssl_status VARCHAR(30) NOT NULL CONSTRAINT DF_sites_ssl_status DEFAULT ('unknown'),
  ssl_hostname_match BIT NULL,

  last_checked_at DATETIME2 NULL,
  check_status VARCHAR(20) NOT NULL CONSTRAINT DF_sites_check_status DEFAULT ('success'),
  health_status VARCHAR(20) NOT NULL CONSTRAINT DF_sites_health_status DEFAULT ('unknown')
);
GO

CREATE UNIQUE INDEX UX_sites_domain ON dbo.sites(domain);
GO

CREATE TABLE dbo.documents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  site_id VARCHAR(36) NULL,
  document_type VARCHAR(40) NOT NULL,
  title NVARCHAR(500) NOT NULL,
  description NVARCHAR(4000) NULL,
  search_text NVARCHAR(MAX) NULL,
  file_path NVARCHAR(2000) NULL,
  file_name NVARCHAR(500) NULL,
  mime_type NVARCHAR(200) NULL,
  file_size_bytes INT NULL,
  uploaded_by NVARCHAR(200) NULL,
  created_at DATETIME2 NOT NULL,
  CONSTRAINT FK_documents_sites FOREIGN KEY (site_id) REFERENCES dbo.sites(id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_documents_site ON dbo.documents(site_id);
GO

CREATE TABLE dbo.check_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  site_id VARCHAR(36) NOT NULL,
  checked_at DATETIME2 NOT NULL,
  domain_status VARCHAR(20) NOT NULL,
  domain_expiry_auto DATETIME2 NULL,
  domain_expiry_source VARCHAR(20) NOT NULL,
  domain_expiry_status VARCHAR(20) NOT NULL,
  dns_status VARCHAR(20) NOT NULL,
  http_status VARCHAR(20) NOT NULL,
  https_status VARCHAR(20) NOT NULL,
  ssl_status VARCHAR(30) NOT NULL,
  ssl_valid_from DATETIME2 NULL,
  ssl_valid_to DATETIME2 NULL,
  ssl_issuer NVARCHAR(2000) NULL,
  ssl_subject NVARCHAR(2000) NULL,
  ssl_hostname_match BIT NULL,
  error_message NVARCHAR(MAX) NULL,
  raw_result_json NVARCHAR(MAX) NULL,
  duration_ms INT NOT NULL,
  CONSTRAINT FK_check_history_sites FOREIGN KEY (site_id) REFERENCES dbo.sites(id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_check_history_site_checked ON dbo.check_history(site_id, checked_at DESC);
GO

CREATE TABLE dbo.alerts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  site_id VARCHAR(36) NOT NULL,
  alert_type VARCHAR(40) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message NVARCHAR(2000) NOT NULL,
  created_at DATETIME2 NOT NULL,
  is_read BIT NOT NULL CONSTRAINT DF_alerts_is_read DEFAULT (0),
  is_resolved BIT NOT NULL CONSTRAINT DF_alerts_is_resolved DEFAULT (0),
  CONSTRAINT FK_alerts_sites FOREIGN KEY (site_id) REFERENCES dbo.sites(id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_alerts_site_resolved ON dbo.alerts(site_id, is_resolved, created_at DESC);
GO

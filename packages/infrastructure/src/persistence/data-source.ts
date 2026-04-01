import { DataSource } from "typeorm";
import { SiteEntity } from "./entities/site.entity.js";
import { SiteDocumentLinkEntity } from "./entities/site-document-link.entity.js";
import { DocumentEntity } from "./entities/document.entity.js";
import { CheckHistoryEntity } from "./entities/check-history.entity.js";
import { AlertEntity } from "./entities/alert.entity.js";
import { MonitoringScheduleEntity } from "./entities/monitoring-schedule.entity.js";
import { AppUserEntity } from "./entities/app-user.entity.js";

const entities = [
  SiteEntity,
  SiteDocumentLinkEntity,
  DocumentEntity,
  CheckHistoryEntity,
  AlertEntity,
  MonitoringScheduleEntity,
  AppUserEntity,
];

export interface SqlServerDataSourceConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

/** SQLite: archivo local; ideal para desarrollo y volúmenes pequeños (~100 sitios). */
export function buildSqliteDataSource(options?: { databasePath?: string; synchronize?: boolean }): DataSource {
  const database = options?.databasePath ?? process.env.DB_PATH ?? ".data/domain-slayer.db";
  const synchronize = options?.synchronize ?? process.env.DB_SYNC !== "false";
  return new DataSource({
    type: "better-sqlite3",
    database,
    synchronize,
    logging: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    entities,
    migrations: [],
  });
}

/** SQL Server: producción / Azure SQL; usar migración SQL manual (`database/migrations/001_initial.sql`). */
export function buildSqlServerDataSource(config: SqlServerDataSourceConfig): DataSource {
  return new DataSource({
    type: "mssql",
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database,
    options: {
      encrypt: config.encrypt,
      trustServerCertificate: config.trustServerCertificate,
    },
    synchronize: false,
    logging: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    entities,
    migrations: [],
  });
}

/**
 * `DB_TYPE=sqlite` (por defecto) | `mssql`
 * SQLite: `DB_PATH`, `DB_SYNC` (default true en dev implícito vía !== "false")
 */
export function buildDataSourceFromEnv(): DataSource {
  const t = (process.env.DB_TYPE ?? "sqlite").toLowerCase();
  if (t === "mssql" || t === "sqlserver") {
    return buildSqlServerDataSource({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 1433),
      username: process.env.DB_USER ?? "sa",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "domain_slayer",
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
    });
  }
  return buildSqliteDataSource();
}

/** @deprecated Usar buildDataSourceFromEnv o buildSqliteDataSource */
export function buildDataSource(config: SqlServerDataSourceConfig): DataSource {
  return buildSqlServerDataSource(config);
}

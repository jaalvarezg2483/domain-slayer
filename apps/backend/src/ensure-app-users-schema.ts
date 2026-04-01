import type { DataSource } from "typeorm";
import type { Logger } from "@domain-slayer/shared";

/** Tabla local de usuarios para login JWT (no confundir con contactos de sitios). */
export async function ensureAppUsersSchema(ds: DataSource, logger: Logger): Promise<void> {
  const type = (ds.options as { type?: string }).type;
  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    if (type === "better-sqlite3") {
      await qr.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id VARCHAR(36) PRIMARY KEY NOT NULL,
          email VARCHAR(320) NOT NULL UNIQUE,
          password_hash VARCHAR(512) NOT NULL,
          created_at datetime NOT NULL
        )
      `);
      logger.info("SQLite: tabla app_users verificada");
    } else if (type === "mssql") {
      await qr.query(`
        IF OBJECT_ID('dbo.app_users', 'U') IS NULL
        CREATE TABLE dbo.app_users (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          email NVARCHAR(320) NOT NULL,
          password_hash NVARCHAR(512) NOT NULL,
          created_at DATETIME2 NOT NULL,
          CONSTRAINT UQ_app_users_email UNIQUE (email)
        )
      `);
      logger.info("SQL Server: tabla dbo.app_users verificada");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, "No se pudo asegurar tabla app_users");
  } finally {
    await qr.release();
  }
}

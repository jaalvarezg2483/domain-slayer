import type { DataSource, QueryRunner } from "typeorm";
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
      await ensureAppUsersExtraColumnsSqlite(qr, logger);
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
      await ensureAppUsersExtraColumnsMssql(qr, logger);
      logger.info("SQL Server: tabla dbo.app_users verificada");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, "No se pudo asegurar tabla app_users");
  } finally {
    await qr.release();
  }
}

async function ensureAppUsersExtraColumnsSqlite(qr: QueryRunner, logger: Logger): Promise<void> {
  const rows = (await qr.query(`PRAGMA table_info(app_users)`)) as { name: string }[];
  const names = new Set(rows.map((r) => r.name));
  if (!names.has("display_name")) {
    await qr.query(`ALTER TABLE app_users ADD COLUMN display_name VARCHAR(200)`);
    logger.info("SQLite: columna app_users.display_name añadida");
  }
  if (!names.has("role")) {
    await qr.query(`ALTER TABLE app_users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin'`);
    logger.info("SQLite: columna app_users.role añadida");
  }
  if (!names.has("home_app")) {
    await qr.query(`ALTER TABLE app_users ADD COLUMN home_app VARCHAR(20) NOT NULL DEFAULT 'inventory'`);
    logger.info("SQLite: columna app_users.home_app añadida");
  }
  await stripEmailLocalAsDisplayNameSqlite(qr, logger);
}

async function ensureAppUsersExtraColumnsMssql(qr: QueryRunner, logger: Logger): Promise<void> {
  await qr.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'display_name' AND Object_ID = Object_ID(N'dbo.app_users'))
      ALTER TABLE dbo.app_users ADD display_name NVARCHAR(200) NULL
  `);
  logger.info("SQL Server: columna app_users.display_name verificada");
  await qr.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'role' AND Object_ID = Object_ID(N'dbo.app_users'))
      ALTER TABLE dbo.app_users ADD role VARCHAR(20) NOT NULL CONSTRAINT DF_app_users_role DEFAULT 'admin'
  `);
  logger.info("SQL Server: columna app_users.role verificada");
  await qr.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'home_app' AND Object_ID = Object_ID(N'dbo.app_users'))
      ALTER TABLE dbo.app_users ADD home_app VARCHAR(20) NOT NULL CONSTRAINT DF_app_users_home_app DEFAULT 'inventory'
  `);
  logger.info("SQL Server: columna app_users.home_app verificada");
  await stripEmailLocalAsDisplayNameMssql(qr, logger);
}

/**
 * Quita `display_name` cuando solo coincide con la parte local del correo (relleno automático antiguo).
 * Así el menú puede mostrar solo nombres reales definidos en Usuarios.
 */
async function stripEmailLocalAsDisplayNameSqlite(qr: QueryRunner, logger: Logger): Promise<void> {
  try {
    await qr.query(`
      UPDATE app_users
      SET display_name = NULL
      WHERE display_name IS NOT NULL
        AND TRIM(display_name) != ''
        AND LOWER(TRIM(display_name)) = LOWER(SUBSTR(email, 1, INSTR(email, '@') - 1))
        AND INSTR(email, '@') > 1
    `);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, "SQLite: no se pudo normalizar display_name");
  }
}

async function stripEmailLocalAsDisplayNameMssql(qr: QueryRunner, logger: Logger): Promise<void> {
  try {
    await qr.query(`
      UPDATE dbo.app_users
      SET display_name = NULL
      WHERE display_name IS NOT NULL
        AND LTRIM(RTRIM(display_name)) != N''
        AND LOWER(LTRIM(RTRIM(display_name))) = LOWER(LEFT(email, CHARINDEX(N'@', email) - 1))
        AND CHARINDEX(N'@', email) > 1
    `);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn({ err: msg }, "SQL Server: no se pudo normalizar display_name");
  }
}

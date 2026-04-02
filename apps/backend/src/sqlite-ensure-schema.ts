import type { DataSource, QueryRunner } from "typeorm";
import type { Logger } from "@domain-slayer/shared";

/** PRAGMA table_info puede devolver objetos `{ name }` o filas en array según driver. */
function pragmaTableColumnNames(raw: unknown): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(raw)) return set;
  for (const row of raw) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const o = row as Record<string, unknown>;
      const n = o.name ?? o.NAME;
      if (n != null && String(n).trim()) set.add(String(n).toLowerCase());
    } else if (Array.isArray(row) && row.length >= 2) {
      set.add(String(row[1]).toLowerCase());
    }
  }
  return set;
}

async function addSqliteColumnIfMissing(
  qr: QueryRunner,
  names: Set<string>,
  col: string,
  logger: Logger
): Promise<void> {
  if (names.has(col)) return;
  try {
    await qr.query(`ALTER TABLE sites ADD COLUMN ${col} TEXT`);
    logger.info(`SQLite: columna sites.${col} añadida`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate column/i.test(msg)) return;
    throw e;
  }
}

/**
 * SQLite sin sincronización automática (DB_SYNC=false) o bases antiguas pueden carecer
 * de columnas/tablas añadidas después. Sin ssl_resolution_notes / domain_resolution_notes
 * el PATCH no persiste las notas.
 */
export async function ensureSqliteSchema(ds: DataSource, logger: Logger): Promise<void> {
  const type = (ds.options as { type?: string }).type;
  if (type !== "better-sqlite3") return;

  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    const raw = await qr.query(`PRAGMA table_info(sites)`);
    const siteNames = pragmaTableColumnNames(raw);
    await addSqliteColumnIfMissing(qr, siteNames, "ssl_resolution_notes", logger);
    await addSqliteColumnIfMissing(qr, siteNames, "domain_resolution_notes", logger);
    await addSqliteColumnIfMissing(qr, siteNames, "ssl_valid_to_manual", logger);
    await addSqliteColumnIfMissing(qr, siteNames, "ssl_expiry_source", logger);
    await addSqliteColumnIfMissing(qr, siteNames, "ssl_valid_to_final", logger);

    try {
      await qr.query(
        `UPDATE sites SET ssl_expiry_source = 'unavailable' WHERE ssl_expiry_source IS NULL OR ssl_expiry_source = ''`
      );
      await qr.query(
        `UPDATE sites SET ssl_valid_to_final = ssl_valid_to WHERE ssl_valid_to IS NOT NULL AND ssl_valid_to_final IS NULL`
      );
      await qr.query(
        `UPDATE sites SET ssl_expiry_source = 'auto' WHERE ssl_valid_to IS NOT NULL AND ssl_expiry_source = 'unavailable'`
      );
    } catch {
      /* tabla vacía o columnas aún no visibles */
    }

    await qr.query(`
      CREATE TABLE IF NOT EXISTS site_document_links (
        site_id VARCHAR(36) NOT NULL,
        document_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (site_id, document_id),
        FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    try {
      const rawMs = await qr.query(`PRAGMA table_info(monitoring_schedule)`);
      const msNames = pragmaTableColumnNames(rawMs);
      if (msNames.size > 0) {
        if (!msNames.has("run_minute")) {
          await qr.query(`ALTER TABLE monitoring_schedule ADD COLUMN run_minute INTEGER NOT NULL DEFAULT 0`);
          logger.info("SQLite: columna monitoring_schedule.run_minute añadida");
        }
        if (!msNames.has("cron_alternate_weeks")) {
          await qr.query(
            `ALTER TABLE monitoring_schedule ADD COLUMN cron_alternate_weeks INTEGER NOT NULL DEFAULT 0`
          );
          logger.info("SQLite: columna monitoring_schedule.cron_alternate_weeks añadida");
        }
        if (!msNames.has("iso_week_parity")) {
          await qr.query(`ALTER TABLE monitoring_schedule ADD COLUMN iso_week_parity INTEGER NULL`);
          logger.info("SQLite: columna monitoring_schedule.iso_week_parity añadida");
        }
        if (!msNames.has("cron_first_week_only")) {
          await qr.query(
            `ALTER TABLE monitoring_schedule ADD COLUMN cron_first_week_only INTEGER NOT NULL DEFAULT 0`
          );
          logger.info("SQLite: columna monitoring_schedule.cron_first_week_only añadida");
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/no such table/i.test(msg)) throw e;
    }
  } finally {
    await qr.release();
  }
}

import type { DataSource } from "typeorm";
import type { Logger } from "@domain-slayer/shared";

function rowSchema(r: Record<string, unknown>): string {
  const v = r.TABLE_SCHEMA ?? r.tableSchema ?? r.Table_Schema;
  return String(v ?? "").replace(/[^\w]/g, "");
}

/**
 * Añade columnas de notas si faltan. Busca `sites` en cualquier esquema (no solo dbo).
 */
export async function ensureMssqlSiteResolutionColumns(ds: DataSource, logger: Logger): Promise<void> {
  const type = (ds.options as { type?: string }).type;
  if (type !== "mssql") return;

  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    const rows = (await qr.query(`
      SELECT TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'sites' AND TABLE_TYPE = 'BASE TABLE'
    `)) as Record<string, unknown>[];

    if (!rows.length) {
      logger.warn("SQL Server: no existe la tabla sites en INFORMATION_SCHEMA");
      return;
    }

    for (const raw of rows) {
      const schema = rowSchema(raw);
      if (!schema) continue;

      const hasCol = async (col: string): Promise<boolean> => {
        const q = await qr.query(
          `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'sites' AND COLUMN_NAME = '${col}'`
        );
        const row = (q as { cnt?: number }[])[0];
        return Number(row?.cnt ?? 0) > 0;
      };

      if (!(await hasCol("ssl_resolution_notes"))) {
        await qr.query(`ALTER TABLE [${schema}].[sites] ADD [ssl_resolution_notes] NVARCHAR(MAX) NULL`);
        logger.info({ schema }, "SQL Server: añadida ssl_resolution_notes");
      }
      if (!(await hasCol("domain_resolution_notes"))) {
        await qr.query(`ALTER TABLE [${schema}].[sites] ADD [domain_resolution_notes] NVARCHAR(MAX) NULL`);
        logger.info({ schema }, "SQL Server: añadida domain_resolution_notes");
      }
    }

    logger.info("SQL Server: columnas de notas de resolución comprobadas");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn(
      { err: msg },
      "SQL Server: no se pudieron asegurar columnas de notas. Ejecute database/migrations/006_site_resolution_notes_and_doc_links.sql manualmente."
    );
  } finally {
    await qr.release();
  }
}

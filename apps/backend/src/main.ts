import "reflect-metadata";
import "./load-env.js";
import fs from "node:fs";
import path from "node:path";
import { ServiceBroker } from "moleculer";
import express from "express";
import cors from "cors";
import { loadEnv, createLogger } from "@domain-slayer/shared";
import { buildDataSourceFromEnv } from "@domain-slayer/infrastructure";
import { SqlUnitOfWork } from "@domain-slayer/infrastructure";
import { createInventoryService } from "@domain-slayer/inventory-service";
import { createDocumentService } from "@domain-slayer/document-service";
import { createAlertingService } from "@domain-slayer/alerting-service";
import { createMonitoringService } from "@domain-slayer/monitoring-service";
import { createApiRouter } from "./api.js";
import { createMonitoringScheduler } from "./monitoring-scheduler.js";
import { registerMonitoringScheduleHttp } from "./monitoring-schedule-routes.js";
import { bootstrapInitialAdmin } from "./auth-http.js";
import { ensureAppUsersSchema } from "./ensure-app-users-schema.js";
import { ensureMssqlSiteResolutionColumns } from "./ensure-mssql-resolution-columns.js";
import { ensureSqliteSchema } from "./sqlite-ensure-schema.js";

async function main() {
  /* Railway/Render/Fly inyectan PORT; si además hay API_PORT (p. ej. 3000), el proxy falla con 503. */
  if (process.env.PORT?.trim()) {
    process.env.API_PORT = process.env.PORT.trim();
  }

  const env = loadEnv();
  const logger = createLogger(env);
  const host = process.env.API_HOST ?? "0.0.0.0";
  const listenPort =
    Number.isFinite(env.API_PORT) && env.API_PORT >= 1 && env.API_PORT <= 65535 ? env.API_PORT : 3000;

  if (process.env.SMTP_HOST?.trim()) {
    logger.info({ host: process.env.SMTP_HOST.trim() }, "SMTP configurado (notificaciones por correo)");
  } else {
    logger.warn("SMTP no configurado: defina SMTP_HOST en .env o variables de entorno y reinicie el backend");
  }

  const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasOllama = Boolean(process.env.OLLAMA_BASE_URL?.trim() || process.env.OLLAMA_HOST?.trim());
  if (hasOpenai) {
    logger.info("OPENAI_API_KEY: resumen/asistente pueden usar OpenAI");
  } else if (hasOllama) {
    logger.info({ ollama: process.env.OLLAMA_BASE_URL ?? process.env.OLLAMA_HOST }, "Ollama configurado (LLM local)");
  } else {
    logger.info(
      "Sin OPENAI_API_KEY ni OLLAMA_BASE_URL: asistente y búsqueda con «IA» usan resumen local (gratis). Opcional: Ollama en su PC o clave OpenAI."
    );
  }

  const dbType = (process.env.DB_TYPE ?? "sqlite").toLowerCase();
  if (dbType === "sqlite") {
    const dbFile = process.env.DB_PATH ?? ".data/domain-slayer.db";
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), dbFile)), { recursive: true });
  }

  const app = express();
  app.disable("x-powered-by");
  /* Antes de TypeORM/Moleculer: el healthcheck de Railway no recibe 503 por arranque lento. */
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  await new Promise<void>((resolve, reject) => {
    const srv = app.listen(listenPort, host, () => {
      logger.info(
        { host, port: listenPort, railwayPort: process.env.PORT ?? null },
        "API HTTP escuchando (healthcheck disponible)"
      );
      resolve();
    });
    srv.on("error", reject);
  });

  const ds = buildDataSourceFromEnv();
  await ds.initialize();
  await ensureSqliteSchema(ds, logger);
  await ensureMssqlSiteResolutionColumns(ds, logger);
  await ensureAppUsersSchema(ds, logger);
  await bootstrapInitialAdmin(ds, logger);
  const dbInfo =
    (process.env.DB_TYPE ?? "sqlite").toLowerCase() === "mssql" ||
    (process.env.DB_TYPE ?? "").toLowerCase() === "sqlserver"
      ? `SQL Server ${process.env.DB_NAME ?? "domain_slayer"}`
      : `SQLite ${process.env.DB_PATH ?? ".data/domain-slayer.db"}`;
  logger.info({ db: dbInfo }, "Base de datos lista");
  if (process.env.JWT_SECRET?.trim()) {
    logger.info("Autenticación JWT activa (defina INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD para el primer usuario)");
  }

  const uow = SqlUnitOfWork.fromDataSource(ds);
  const getUow = () => uow;

  const sslTimeout = Number(process.env.SSL_CHECK_TIMEOUT_MS ?? 10_000);
  const httpTimeout = Number(process.env.HTTP_CHECK_TIMEOUT_MS ?? 8000);
  const alertDays = (process.env.ALERT_SSL_DAYS ?? "60,30,15,7,1")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n));

  const broker = new ServiceBroker({
    logger: false,
    transporter: process.env.TRANSPORTER || undefined,
  });

  broker.createService(createInventoryService(getUow));
  broker.createService(createDocumentService(getUow));
  broker.createService(createAlertingService(getUow));
  broker.createService(
    createMonitoringService(getUow, {
      sslTimeoutMs: sslTimeout,
      httpTimeoutMs: httpTimeout,
      alertDays,
    })
  );

  await broker.start();

  const scheduler = createMonitoringScheduler(broker, ds, logger);

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads", "documents"));
  registerMonitoringScheduleHttp(app, ds, () => scheduler.reschedule(), broker);
  app.use(
    "/api",
    createApiRouter(broker, {
      uploadDir,
      dataSource: ds,
    })
  );

  /* Producción (p. ej. Railway): mismo proceso sirve el build de Vite en apps/frontend/dist */
  const feDist = path.resolve(process.cwd(), "apps/frontend/dist");
  const feIndex = path.join(feDist, "index.html");
  if (fs.existsSync(feIndex)) {
    app.use(express.static(feDist));
    app.get("*", (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) return next();
      res.sendFile(feIndex);
    });
  }

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

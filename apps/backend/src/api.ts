import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DataSource } from "typeorm";
import { AppError, NotFoundError, ValidationError } from "@domain-slayer/shared";
import type { ServiceBroker } from "moleculer";
import { Errors } from "moleculer";
import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware, registerAuthRoutes } from "./auth-http.js";
import multer from "multer";
import { extractSearchableText } from "./extract-document-text.js";
import { structuredLibraryAnswer, summarizeLibraryHits } from "./library-ai-answer.js";
import { buildLocalSearchSummary } from "./library-local-intel.js";
import { resolveLlmConfig } from "./llm-config.js";
import { libraryDedicatedAssistant } from "./library-assistant.js";
import { registerUserAdminRoutes } from "./user-admin-routes.js";
import type { DocumentSearchHit } from "@domain-slayer/application";
/** No enviar texto indexado completo al navegador (credenciales). */
function sanitizeSearchHitsForClient(items: DocumentSearchHit[]): DocumentSearchHit[] {
  return items.map((h) => ({
    ...h,
    document: {
      ...h.document,
      searchText: null,
    },
  }));
}

/**
 * Moleculer/JSON pueden omitir claves `undefined`; el frontend interpretaba `undefined` como «vacío» y borraba el texto.
 * Forzamos siempre `sslResolutionNotes` y `domainResolutionNotes` (string | null) en la respuesta.
 */
function withSiteResolutionNotes<T extends Record<string, unknown>>(site: T): T & { sslResolutionNotes: string | null; domainResolutionNotes: string | null } {
  return {
    ...site,
    sslResolutionNotes: (site.sslResolutionNotes as string | null | undefined) ?? null,
    domainResolutionNotes: (site.domainResolutionNotes as string | null | undefined) ?? null,
  };
}

/**
 * Multer/Express a veces exponen el nombre UTF-8 como Latin-1 (p. ej. «DocumentaciÃ³n» en vez de «Documentación»).
 */
function normalizeUploadedOriginalName(name: string): string {
  if (!name || !/Ã|Â/.test(name)) return name;
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    if (decoded.includes("\uFFFD") || decoded.length === 0) return name;
    return decoded;
  } catch {
    return name;
  }
}

const ALLOWED_DOC_TYPES = new Set([
  "technical_manual",
  "provider_data",
  "payment_info",
  "dns_data",
  "contacts",
  "observations",
  "certificate",
  "operational_notes",
  "other",
]);

export interface ApiRouterOptions {
  /** Directorio donde guardar archivos subidos (PDF, Office, etc.) */
  uploadDir?: string;
  /** Conexión TypeORM (login JWT y tabla app_users). */
  dataSource?: DataSource;
}

export function createApiRouter(broker: ServiceBroker, options?: ApiRouterOptions): Router {
  const r = Router();

  r.use(authMiddleware);
  if (options?.dataSource) {
    registerAuthRoutes(r, options.dataSource);
    registerUserAdminRoutes(r, options.dataSource);
  }

  const uploadDir =
    options?.uploadDir ?? path.join(process.cwd(), "data", "uploads", "documents");
  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 35 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/\.(pdf|docx|xlsx|xls|csv|txt)$/i.test(file.originalname)) {
        cb(null, true);
        return;
      }
      cb(new Error("Formato no permitido. Use PDF, Word .docx, Excel .xlsx o .xls, CSV o TXT."));
    },
  });

  r.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  r.get("/ready", (_req, res) => {
    res.json({ ready: true });
  });

  r.get("/sites", async (req, res, next) => {
    try {
      const out = (await broker.call("inventory.sites.list", req.query)) as {
        items: Record<string, unknown>[];
        total: number;
      };
      res.json({
        total: out.total,
        items: (out.items ?? []).map((it) => withSiteResolutionNotes(it)),
      });
    } catch (e) {
      next(e);
    }
  });

  r.get("/sites/:id", async (req, res, next) => {
    try {
      const out = await broker.call("inventory.sites.get", { id: req.params.id });
      res.json(withSiteResolutionNotes(out as Record<string, unknown>));
    } catch (e) {
      next(e);
    }
  });

  r.post("/sites", async (req, res, next) => {
    try {
      const out = await broker.call("inventory.sites.create", { payload: req.body });
      res.status(201).json(out);
    } catch (e) {
      next(e);
    }
  });

  r.patch("/sites/:id", async (req, res, next) => {
    try {
      const out = await broker.call("inventory.sites.update", { id: req.params.id, payload: req.body });
      res.json(withSiteResolutionNotes(out as Record<string, unknown>));
    } catch (e) {
      next(e);
    }
  });

  r.post("/sites/:siteId/document-links", async (req, res, next) => {
    try {
      const documentId = String((req.body as { documentId?: unknown })?.documentId ?? "").trim();
      if (!documentId) {
        res.status(400).json({ error: "Indique documentId." });
        return;
      }
      const out = await broker.call("inventory.sites.documentLinks.add", {
        siteId: req.params.siteId,
        documentId,
      });
      res.status(201).json(out);
    } catch (e) {
      next(e);
    }
  });

  r.delete("/sites/:siteId/document-links/:documentId", async (req, res, next) => {
    try {
      await broker.call("inventory.sites.documentLinks.remove", {
        siteId: req.params.siteId,
        documentId: req.params.documentId,
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  r.delete("/sites/:id", async (req, res, next) => {
    try {
      await broker.call("inventory.sites.delete", { id: req.params.id });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  r.get("/sites/:siteId/documents", async (req, res, next) => {
    try {
      const out = await broker.call("documents.docs.list", { siteId: req.params.siteId });
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.post(
    "/documents/upload",
    upload.single("file") as any,
    async (req: Request, res: Response, next: NextFunction) => {
      const file = (
        req as Request & {
          file?: { path: string; mimetype: string; originalname: string; size: number };
        }
      ).file;
      if (!file) {
        res.status(400).json({ error: "Debe adjuntar un archivo (campo «file»)." });
        return;
      }
      const siteIdRaw = String(req.body.siteId ?? "").trim();
      const siteIdLower = siteIdRaw.toLowerCase();
      const siteId =
        !siteIdRaw ||
        siteIdLower === "null" ||
        siteIdLower === "undefined" ||
        siteIdLower === "none"
          ? null
          : siteIdRaw;
      const titleRaw = String(req.body.title ?? "").trim();
      const description = req.body.description != null ? String(req.body.description).trim() : "";
      const docTypeRaw = String(req.body.documentType ?? "operational_notes").trim();
      if (!ALLOWED_DOC_TYPES.has(docTypeRaw)) {
        await fs.promises.unlink(file.path).catch(() => {});
        res.status(400).json({ error: "documentType no válido." });
        return;
      }

      try {
        const origName = normalizeUploadedOriginalName(file.originalname);
        const buffer = await fs.promises.readFile(file.path);
        const stem = path.basename(file.path, path.extname(file.path));
        const mediaDir = path.join(path.dirname(file.path), `${stem}_media`);
        const { text, extractionNote, embeddedMedia } = await extractSearchableText(
          buffer,
          file.mimetype,
          origName,
          /\.docx$/i.test(origName)
            ? { docxMediaDir: mediaDir, cwd: process.cwd() }
            : undefined
        );
        const title = titleRaw || origName;
        const header = `[Archivo: ${origName}]\n\n`;
        const body =
          text.length > 0
            ? text
            : "(No se extrajo texto automático; p. ej. PDF escaneado sin OCR. Puede añadir otro documento con texto pegado.)";
        const searchText = (header + body).slice(0, 2_000_000);

        const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");

        const out = await broker.call("documents.docs.create", {
          payload: {
            siteId,
            documentType: docTypeRaw,
            title,
            description: description.length > 0 ? description : null,
            searchText,
            filePath: relativePath,
            fileName: origName,
            mimeType: file.mimetype || null,
            fileSizeBytes: file.size,
            ...(embeddedMedia != null && embeddedMedia.length > 0 ? { embeddedMedia } : {}),
          },
        });

        res.status(201).json({ ...(out as object), extractionNote: extractionNote ?? undefined });
      } catch (e) {
        await fs.promises.unlink(file.path).catch(() => {});
        next(e);
      }
    }
  );

  r.get("/documents/search", async (req, res, next) => {
    try {
      const rawQ = req.query.q;
      const q = String(Array.isArray(rawQ) ? rawQ[0] : rawQ ?? "");
      const rawL = req.query.limit;
      const rawO = req.query.offset;
      const limit =
        rawL != null && rawL !== "" ? Number(Array.isArray(rawL) ? rawL[0] : rawL) : undefined;
      const offset =
        rawO != null && rawO !== "" ? Number(Array.isArray(rawO) ? rawO[0] : rawO) : undefined;
      const rawMatch = req.query.match;
      const matchStr = String(Array.isArray(rawMatch) ? rawMatch[0] : rawMatch ?? "").toLowerCase();
      const match = matchStr === "all" ? "all" : matchStr === "any" ? "any" : undefined;
      const rawAi = req.query.ai;
      const aiParam = Array.isArray(rawAi) ? rawAi[0] : rawAi;
      const wantAi =
        aiParam === "1" || String(aiParam).toLowerCase() === "true" || String(aiParam) === "yes";

      const out = (await broker.call("documents.docs.search", {
        q,
        limit: limit !== undefined && !Number.isNaN(limit) ? limit : undefined,
        offset: offset !== undefined && !Number.isNaN(offset) ? offset : undefined,
        match,
      })) as { items: DocumentSearchHit[]; total: number };

      const payload: Record<string, unknown> = {
        items: sanitizeSearchHitsForClient(out.items),
        total: out.total,
      };

      if (wantAi) {
        const cfg = resolveLlmConfig();
        if (!cfg) {
          payload.aiAnswer = buildLocalSearchSummary(q, out.items);
          payload.aiLocal = true;
        } else if (cfg.kind === "openai") {
          const structured = await structuredLibraryAnswer(q, out.items, cfg);
          if (structured.ok) {
            payload.aiStructured = {
              summary: structured.summary,
              blocks: structured.blocks,
            };
          } else {
            const plain = await summarizeLibraryHits(q, out.items, cfg);
            if (plain.ok) {
              payload.aiAnswer = plain.answer;
            } else {
              payload.aiError = structured.error || plain.error;
              payload.aiAnswer = buildLocalSearchSummary(q, out.items);
              payload.aiLocal = true;
            }
          }
        } else {
          const plain = await summarizeLibraryHits(q, out.items, cfg);
          if (plain.ok) {
            payload.aiAnswer = plain.answer;
          } else {
            payload.aiError = plain.error;
            payload.aiAnswer = buildLocalSearchSummary(q, out.items);
            payload.aiLocal = true;
          }
        }
      }

      res.json(payload);
    } catch (e) {
      next(e);
    }
  });

  r.get("/documents", async (req, res, next) => {
    try {
      const rawL = req.query.limit;
      const rawO = req.query.offset;
      const limit =
        rawL != null && rawL !== "" ? Number(Array.isArray(rawL) ? rawL[0] : rawL) : undefined;
      const offset =
        rawO != null && rawO !== "" ? Number(Array.isArray(rawO) ? rawO[0] : rawO) : undefined;
      const out = await broker.call("documents.docs.libraryList", {
        limit: limit !== undefined && !Number.isNaN(limit) ? limit : undefined,
        offset: offset !== undefined && !Number.isNaN(offset) ? offset : undefined,
      });
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.post("/library/assistant", async (req, res, next) => {
    try {
      const q = String(req.body?.question ?? "").trim();
      if (!q) {
        res.status(400).json({ error: "Escriba una pregunta." });
        return;
      }

      const [docOut, listOut] = await Promise.all([
        broker.call("documents.docs.search", {
          q,
          limit: 36,
          offset: 0,
        }) as Promise<{ items: DocumentSearchHit[]; total: number }>,
        broker.call("inventory.sites.list", {
          search: q.slice(0, 240),
          searchMatch: "all",
          strictTextSearch: true,
          limit: 60,
          offset: 0,
        }) as Promise<{ items: Record<string, unknown>[]; total: number }>,
      ]);

      const siteById = new Map<string, Record<string, unknown>>();
      for (const it of listOut.items ?? []) {
        const id = it?.id != null ? String(it.id) : "";
        if (id) siteById.set(id, it);
      }

      for (const h of docOut.items ?? []) {
        const sid = h.document.siteId;
        if (sid && !siteById.has(sid)) {
          try {
            const s = (await broker.call("inventory.sites.get", { id: sid })) as Record<string, unknown>;
            const id = s?.id != null ? String(s.id) : "";
            if (id) siteById.set(id, s);
          } catch {
            /* sitio eliminado */
          }
        }
      }

      const result = await libraryDedicatedAssistant(q, {
        sites: [...siteById.values()],
        documentHits: docOut.items ?? [],
      });

      if (!result.ok) {
        res.status(422).json({ error: result.error });
        return;
      }

      res.json({
        answer: result.answer,
        answerMode: result.mode,
        sources: {
          documentCount: docOut.items?.length ?? 0,
          siteCount: siteById.size,
          totalDocumentsMatching: docOut.total ?? 0,
        },
        documentRefs: (docOut.items ?? []).map((h) => ({
          id: h.document.id,
          title: h.document.title,
          embeddedMedia: h.document.embeddedMedia ?? null,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/documents", async (req, res, next) => {
    try {
      const out = await broker.call("documents.docs.create", { payload: req.body });
      res.status(201).json(out);
    } catch (e) {
      next(e);
    }
  });

  r.patch("/documents/:id", async (req, res, next) => {
    try {
      const out = await broker.call("documents.docs.update", { id: req.params.id, payload: req.body });
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.get("/documents/:id/embedded-media/:fileName", async (req, res, next) => {
    try {
      const id = String(req.params.id ?? "").trim();
      const fileName = path.basename(String(req.params.fileName ?? ""));
      if (!id || !/^img-\d+\.[a-z0-9]+$/i.test(fileName)) {
        res.status(400).json({ error: "Solicitud no válida." });
        return;
      }
      const doc = (await broker.call("documents.docs.get", { id })) as {
        embeddedMedia?: { fileName: string; contentType: string; relativePath: string }[] | null;
      };
      if (!doc) {
        res.status(404).json({ error: "Documento no encontrado." });
        return;
      }
      const list = doc.embeddedMedia ?? [];
      const item = list.find((m) => m.fileName === fileName);
      if (!item) {
        res.status(404).end();
        return;
      }
      const abs = path.isAbsolute(item.relativePath)
        ? item.relativePath
        : path.join(process.cwd(), item.relativePath);
      const normalized = path.normalize(abs);
      const cwd = path.resolve(process.cwd());
      if (!normalized.startsWith(cwd)) {
        res.status(403).end();
        return;
      }
      const rel = path.relative(cwd, normalized);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        res.status(403).end();
        return;
      }
      res.setHeader("Content-Type", item.contentType || "application/octet-stream");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.sendFile(normalized, (err) => {
        if (err) next(err);
      });
    } catch (e) {
      next(e);
    }
  });

  r.delete("/documents/:id", async (req, res, next) => {
    try {
      const doc = (await broker.call("documents.docs.get", { id: req.params.id })) as {
        filePath?: string | null;
        embeddedMedia?: { relativePath: string }[] | null;
      };
      await broker.call("documents.docs.delete", { id: req.params.id });
      const fp = doc.filePath;
      if (fp && typeof fp === "string" && fp.trim()) {
        const abs = path.isAbsolute(fp) ? fp : path.join(process.cwd(), fp);
        await fs.promises.unlink(abs).catch(() => {});
      }
      const media = doc.embeddedMedia ?? [];
      if (media.length > 0) {
        const firstAbs = path.isAbsolute(media[0].relativePath)
          ? media[0].relativePath
          : path.join(process.cwd(), media[0].relativePath);
        const mediaDir = path.dirname(firstAbs);
        await fs.promises.rm(mediaDir, { recursive: true, force: true }).catch(() => {});
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  r.get("/alerts", async (req, res, next) => {
    try {
      const out = await broker.call("alerting.alerts.list", req.query);
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.post("/alerts/resolve-all", async (_req, res, next) => {
    try {
      const out = await broker.call("alerting.alerts.resolveAllOpen");
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.post("/alerts/:id/read", async (req, res, next) => {
    try {
      await broker.call("alerting.alerts.read", { id: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.post("/alerts/:id/resolve", async (req, res, next) => {
    try {
      await broker.call("alerting.alerts.resolve", { id: req.params.id });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  r.get("/sites/:siteId/history", async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? 50);
      const offset = Number(req.query.offset ?? 0);
      const out = await broker.call("inventory.sites.history", {
        siteId: req.params.siteId,
        limit,
        offset,
      });
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.post("/monitoring/check/:siteId", async (req, res, next) => {
    try {
      const out = await broker.call("monitoring.check.runOne", { siteId: req.params.siteId });
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.post("/monitoring/check-all", async (_req, res, next) => {
    try {
      const out = await broker.call("monitoring.check.runAll");
      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  r.get("/dashboard/summary", async (_req, res, next) => {
    try {
      const sites = (await broker.call("inventory.sites.list", { limit: 500, offset: 0 })) as {
        items: Record<string, unknown>[];
        total: number;
      };
      const alerts = await broker.call("alerting.alerts.list", { isResolved: false, limit: 200, offset: 0 });
      res.json({
        sites: {
          total: sites.total,
          items: (sites.items ?? []).map((it) => withSiteResolutionNotes(it)),
        },
        alerts,
      });
    } catch (e) {
      next(e);
    }
  });

  r.use((req: Request, res: Response) => {
    res.status(404).json({
      error:
        `Ruta API no encontrada: ${req.method} ${req.originalUrl}. ` +
        `Si intentaba subir un documento, el backend debe incluir POST /api/documents/upload (recompile y reinicie).`,
    });
  });

  r.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const multerErr = err as multer.MulterError;
      if (multerErr.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Archivo demasiado grande (máx. 35 MB)." });
        return;
      }
    }
    if (err instanceof Error && err.message.includes("Formato no permitido")) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ValidationError) {
      res.status(422).json({ error: err.message, details: err.details });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    if (err instanceof Errors.MoleculerError) {
      const code = typeof err.code === "number" && err.code >= 400 ? err.code : 500;
      res.status(code).json({ error: err.message, type: err.type });
      return;
    }
    const msg = err instanceof Error ? err.message : "Error interno";
    const status = msg.includes("no está soportado") || msg.includes("no reconocido") ? 400 : 500;
    res.status(status).json({ error: msg });
  });

  return r;
}

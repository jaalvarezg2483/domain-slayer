import type { SiteDocument, SiteDocumentCreateInput, SiteDocumentUpdateInput } from "@domain-slayer/domain";
import { NotFoundError, ValidationError } from "@domain-slayer/shared";
import type { DocumentRepository, DocumentSearchHit } from "../ports/document-repository.js";
import type { SiteRepository } from "../ports/site-repository.js";
import { tokenizeSearchQuery } from "../lib/document-search.js";
import {
  buildLibrarySearchSnippet,
  foldedTokenWholeWordMatch,
  foldSpanishAccents,
  libraryHaystackMatchesAllTokensInOneSegment,
  libraryHitTitleRelevance,
  librarySingleTokenCredentialNoise,
  librarySingleTokenNeedsRefinement,
} from "@domain-slayer/shared";
import { z } from "zod";

const docType = z.enum([
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

function normalizeSiteId(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s.length === 0) return null;
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "none") return null;
  return s;
}

const createSchema = z.object({
  /** Opcional: si falta o es vacío → documento global (sin sitio). */
  siteId: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => normalizeSiteId(v))
    .pipe(z.union([z.string().min(1), z.null()])),
  documentType: docType,
  title: z.string().min(1).max(500),
  description: z.string().max(4000).nullable().optional(),
  searchText: z.string().max(2_000_000).nullable().optional(),
  filePath: z.string().max(2000).nullable().optional(),
  fileName: z.string().max(500).nullable().optional(),
  mimeType: z.string().max(200).nullable().optional(),
  fileSizeBytes: z.number().int().nonnegative().nullable().optional(),
  uploadedBy: z.string().max(200).nullable().optional(),
  embeddedMedia: z
    .array(
      z.object({
        relativePath: z.string().min(1).max(2000),
        contentType: z.string().min(1).max(200),
        fileName: z.string().min(1).max(260),
      })
    )
    .max(80)
    .optional()
    .nullable(),
});

const updateSchema = createSchema.omit({ siteId: true }).partial();

export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly sites: SiteRepository
  ) {}

  async create(raw: unknown): Promise<SiteDocument> {
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError("Documento inválido", parsed.error.flatten());
    }
    if (parsed.data.siteId) {
      const site = await this.sites.findById(parsed.data.siteId);
      if (!site) throw new NotFoundError("Sitio", parsed.data.siteId);
    }
    const input: SiteDocumentCreateInput = {
      siteId: parsed.data.siteId ?? null,
      documentType: parsed.data.documentType,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      searchText: parsed.data.searchText ?? null,
      filePath: parsed.data.filePath ?? null,
      fileName: parsed.data.fileName ?? null,
      mimeType: parsed.data.mimeType ?? null,
      fileSizeBytes: parsed.data.fileSizeBytes ?? null,
      uploadedBy: parsed.data.uploadedBy ?? null,
      ...(parsed.data.embeddedMedia != null && parsed.data.embeddedMedia.length > 0
        ? { embeddedMedia: parsed.data.embeddedMedia }
        : {}),
    };
    return this.documents.create(input);
  }

  async update(id: string, raw: unknown): Promise<SiteDocument> {
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError("Actualización inválida", parsed.error.flatten());
    }
    const updated = await this.documents.update(id, parsed.data as SiteDocumentUpdateInput);
    if (!updated) throw new NotFoundError("Documento", id);
    return updated;
  }

  listBySite(siteId: string) {
    return this.documents.listBySiteId(siteId);
  }

  getById(id: string) {
    return this.documents.findById(id);
  }

  /**
   * Listado para gestión de biblioteca (sin texto indexado completo).
   */
  async listLibrary(opts?: { limit?: number; offset?: number }): Promise<{
    items: Array<{
      id: string;
      siteId: string | null;
      siteName: string | null;
      documentType: string;
      title: string;
      description: string | null;
      fileName: string | null;
      fileSizeBytes: number | null;
      mimeType: string | null;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const { items, total } = await this.documents.listAll({ limit, offset });
    const siteIds = [...new Set(items.map((d) => d.siteId).filter((id): id is string => Boolean(id)))];
    const siteMap = new Map<string, string>();
    for (const sid of siteIds) {
      const s = await this.sites.findById(sid);
      if (s) siteMap.set(sid, s.siteName);
    }
    return {
      items: items.map((d) => ({
        id: d.id,
        siteId: d.siteId,
        siteName: d.siteId ? siteMap.get(d.siteId) ?? null : null,
        documentType: d.documentType,
        title: d.title,
        description: d.description,
        fileName: d.fileName,
        fileSizeBytes: d.fileSizeBytes,
        mimeType: d.mimeType,
        createdAt: d.createdAt,
      })),
      total,
    };
  }

  /**
   * Búsqueda por palabras clave; documentos y datos del sitio vinculado.
   * Con varias palabras, por defecto `match: "all"` (todas deben aparecer en el documento).
   * El fragmento (`snippet`) además prioriza filas/bloques donde coincidan todas (ver shared).
   */
  async searchLibrary(
    query: string,
    opts?: { limit?: number; offset?: number; match?: "all" | "any" }
  ): Promise<{ items: DocumentSearchHit[]; total: number }> {
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length === 0) {
      return { items: [], total: 0 };
    }
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const match = opts?.match ?? (tokens.length >= 2 ? "all" : "any");

    /**
     * Con 2+ términos, el SQL puede devolver documentos donde cada palabra aparece en filas distintas del Excel.
     * Exigimos que todas las palabras caigan en un mismo bloque/fila (p. ej. solo Toyota + enlace desarrollo).
     */
    const coherent = tokens.length >= 2 && match === "all";
    if (!coherent) {
      const single = tokens.length === 1 ? tokens[0] : "";
      const singleFolded = single ? foldSpanishAccents(single) : "";
      const refineSingle =
        tokens.length === 1 && librarySingleTokenNeedsRefinement(single, singleFolded);

      if (refineSingle) {
        const fetchCap = Math.min(2000, Math.max(offset + limit + 120, 480));
        const raw = await this.documents.searchLibrary(tokens, {
          limit: fetchCap,
          offset: 0,
          match,
        });
        let items = raw.items;
        if (single.length >= 6) {
          items = items.filter((hit) => {
            const hay = [
              hit.document.title,
              hit.document.description ?? "",
              hit.document.searchText ?? "",
              hit.document.fileName ?? "",
              hit.siteName ?? "",
              hit.domain ?? "",
            ].join("\n");
            return foldedTokenWholeWordMatch(hay, singleFolded);
          });
        }
        items = items.filter((hit) => !librarySingleTokenCredentialNoise(singleFolded, hit.document));
        items.sort(
          (a, b) =>
            libraryHitTitleRelevance(b.document.title, tokens) -
            libraryHitTitleRelevance(a.document.title, tokens)
        );
        const total = items.length;
        items = items.slice(offset, offset + limit).map((hit) => ({
          ...hit,
          snippet: buildLibrarySearchSnippet(hit.document, tokens) ?? hit.snippet,
        }));
        return { items, total };
      }

      return this.documents.searchLibrary(tokens, { limit, offset, match });
    }

    const maxScan = Math.min(Math.max(offset + limit + 120, 180), 450);
    const raw = await this.documents.searchLibrary(tokens, {
      limit: maxScan,
      offset: 0,
      match,
    });

    let items = raw.items.filter((hit) => {
      const hay = [
        hit.document.title,
        hit.document.description ?? "",
        hit.document.searchText ?? "",
      ].join("\n");
      return libraryHaystackMatchesAllTokensInOneSegment(hay, tokens);
    });

    items.sort(
      (a, b) =>
        libraryHitTitleRelevance(b.document.title, tokens) -
        libraryHitTitleRelevance(a.document.title, tokens)
    );

    const total = items.length;
    items = items.slice(offset, offset + limit);
    items = items.map((hit) => ({
      ...hit,
      snippet: buildLibrarySearchSnippet(hit.document, tokens) ?? hit.snippet,
    }));

    return { items, total };
  }

  async delete(id: string) {
    const ok = await this.documents.delete(id);
    if (!ok) throw new NotFoundError("Documento", id);
  }
}

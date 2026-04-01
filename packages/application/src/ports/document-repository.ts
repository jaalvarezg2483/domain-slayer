import type { SiteDocument, SiteDocumentCreateInput, SiteDocumentUpdateInput } from "@domain-slayer/domain";

export interface DocumentSearchHit {
  document: SiteDocument;
  siteName: string;
  domain: string;
  snippet: string | null;
}

export interface DocumentRepository {
  create(input: SiteDocumentCreateInput): Promise<SiteDocument>;
  update(id: string, input: SiteDocumentUpdateInput): Promise<SiteDocument | null>;
  findById(id: string): Promise<SiteDocument | null>;
  listBySiteId(siteId: string): Promise<SiteDocument[]>;
  /** Todos los documentos (biblioteca), más recientes primero. */
  listAll(opts: { limit: number; offset: number }): Promise<{ items: SiteDocument[]; total: number }>;
  delete(id: string): Promise<boolean>;
  /**
   * Palabras clave sobre título, descripción, texto indexable, archivo, sitio (nombre, dominio, notas).
   * Comparación insensible a tildes. `match`: todas las palabras (and) o cualquiera (or).
   */
  searchLibrary(
    tokens: string[],
    opts: { limit: number; offset: number; match?: "all" | "any" }
  ): Promise<{ items: DocumentSearchHit[]; total: number }>;
}

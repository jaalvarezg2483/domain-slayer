import type { DocumentType } from "./enums.js";

/** Figuras extraídas de Word al indexar (rutas relativas al cwd del servidor). */
export interface DocumentEmbeddedMediaItem {
  fileName: string;
  contentType: string;
  relativePath: string;
}

export interface SiteDocument {
  id: string;
  /** Si es null, el documento es global (p. ej. Excel con datos de varios sistemas). */
  siteId: string | null;
  documentType: DocumentType;
  title: string;
  description: string | null;
  /** Texto libre indexable (p. ej. datos pegados de Excel: entornos, BD, contraseñas). */
  searchText: string | null;
  filePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  /** Imágenes incrustadas en .docx (vacío o null si no hay). */
  embeddedMedia: DocumentEmbeddedMediaItem[] | null;
  uploadedBy: string | null;
  createdAt: Date;
}

export type SiteDocumentCreateInput = Omit<SiteDocument, "id" | "createdAt" | "embeddedMedia"> & {
  embeddedMedia?: DocumentEmbeddedMediaItem[] | null;
};

export type SiteDocumentUpdateInput = Partial<
  Pick<
    SiteDocument,
    | "documentType"
    | "title"
    | "description"
    | "searchText"
    | "filePath"
    | "fileName"
    | "mimeType"
    | "fileSizeBytes"
    | "embeddedMedia"
  >
>;

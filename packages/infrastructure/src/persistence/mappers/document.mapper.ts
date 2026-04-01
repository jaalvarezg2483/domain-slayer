import type { DocumentEmbeddedMediaItem, SiteDocument } from "@domain-slayer/domain";
import type { DocumentEntity } from "../entities/document.entity.js";

function parseEmbeddedMediaJson(raw: string | null | undefined): DocumentEmbeddedMediaItem[] | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v) || v.length === 0) return null;
    const out: DocumentEmbeddedMediaItem[] = [];
    for (const x of v) {
      if (x == null || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const fileName = typeof o.fileName === "string" ? o.fileName : "";
      const contentType = typeof o.contentType === "string" ? o.contentType : "";
      const relativePath = typeof o.relativePath === "string" ? o.relativePath : "";
      if (fileName && relativePath) out.push({ fileName, contentType, relativePath });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function mapDocumentEntityToDomain(e: DocumentEntity): SiteDocument {
  return {
    id: e.id,
    siteId: e.siteId,
    documentType: e.documentType as SiteDocument["documentType"],
    title: e.title,
    description: e.description,
    searchText: e.searchText,
    embeddedMedia: parseEmbeddedMediaJson(e.embeddedMediaJson),
    filePath: e.filePath,
    fileName: e.fileName,
    mimeType: e.mimeType,
    fileSizeBytes: e.fileSizeBytes,
    uploadedBy: e.uploadedBy,
    createdAt: e.createdAt,
  };
}

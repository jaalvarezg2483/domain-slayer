export interface SiteDocumentLinkRepository {
  listBySiteId(siteId: string): Promise<{ documentId: string }[]>;
  add(siteId: string, documentId: string): Promise<void>;
  remove(siteId: string, documentId: string): Promise<boolean>;
}

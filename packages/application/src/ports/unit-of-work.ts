import type { SiteRepository } from "./site-repository.js";
import type { DocumentRepository } from "./document-repository.js";
import type { SiteDocumentLinkRepository } from "./site-document-link-repository.js";
import type { CheckHistoryRepository } from "./check-history-repository.js";
import type { AlertRepository } from "./alert-repository.js";

export interface UnitOfWork {
  sites: SiteRepository;
  documents: DocumentRepository;
  siteDocumentLinks: SiteDocumentLinkRepository;
  checkHistory: CheckHistoryRepository;
  alerts: AlertRepository;
  transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T>;
}

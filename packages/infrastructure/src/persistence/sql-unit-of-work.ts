import type { DataSource, EntityManager } from "typeorm";
import type { UnitOfWork } from "@domain-slayer/application";
import { SqlSiteRepository } from "./repositories/sql-site-repository.js";
import { SqlSiteDocumentLinkRepository } from "./repositories/sql-site-document-link-repository.js";
import { SqlDocumentRepository } from "./repositories/sql-document-repository.js";
import { SqlCheckHistoryRepository } from "./repositories/sql-check-history-repository.js";
import { SqlAlertRepository } from "./repositories/sql-alert-repository.js";

export class SqlUnitOfWork implements UnitOfWork {
  readonly sites: SqlSiteRepository;
  readonly documents: SqlDocumentRepository;
  readonly siteDocumentLinks: SqlSiteDocumentLinkRepository;
  readonly checkHistory: SqlCheckHistoryRepository;
  readonly alerts: SqlAlertRepository;

  private constructor(
    manager: EntityManager,
    private readonly rootDataSource?: DataSource
  ) {
    this.sites = new SqlSiteRepository(manager);
    this.documents = new SqlDocumentRepository(manager);
    this.siteDocumentLinks = new SqlSiteDocumentLinkRepository(manager);
    this.checkHistory = new SqlCheckHistoryRepository(manager);
    this.alerts = new SqlAlertRepository(manager);
  }

  static fromDataSource(ds: DataSource): SqlUnitOfWork {
    return new SqlUnitOfWork(ds.manager, ds);
  }

  private static fromManager(manager: EntityManager): SqlUnitOfWork {
    return new SqlUnitOfWork(manager);
  }

  async transaction<T>(fn: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    if (!this.rootDataSource) {
      throw new Error("transaction() solo disponible desde SqlUnitOfWork.fromDataSource");
    }
    return this.rootDataSource.transaction(async (manager) => {
      const uow = SqlUnitOfWork.fromManager(manager);
      return fn(uow);
    });
  }
}

import type { SiteDocumentLinkRepository } from "@domain-slayer/application";
import type { EntityManager, Repository } from "typeorm";
import { SiteDocumentLinkEntity } from "../entities/site-document-link.entity.js";

export class SqlSiteDocumentLinkRepository implements SiteDocumentLinkRepository {
  constructor(private readonly em: EntityManager) {}

  private get repo(): Repository<SiteDocumentLinkEntity> {
    return this.em.getRepository(SiteDocumentLinkEntity);
  }

  async listBySiteId(siteId: string): Promise<{ documentId: string }[]> {
    const rows = await this.repo.find({ where: { siteId }, order: { documentId: "ASC" } });
    return rows.map((r) => ({ documentId: r.documentId }));
  }

  async add(siteId: string, documentId: string): Promise<void> {
    const row = this.repo.create({ siteId, documentId });
    await this.repo.save(row);
  }

  async remove(siteId: string, documentId: string): Promise<boolean> {
    const res = await this.repo.delete({ siteId, documentId });
    return (res.affected ?? 0) > 0;
  }
}

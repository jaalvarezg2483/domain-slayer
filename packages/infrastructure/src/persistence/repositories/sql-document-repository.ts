import { createId } from "@paralleldrive/cuid2";
import type { SiteDocument, SiteDocumentCreateInput, SiteDocumentUpdateInput } from "@domain-slayer/domain";
import type { DocumentRepository, DocumentSearchHit } from "@domain-slayer/application";
import { buildLibrarySearchSnippet, escapeSqlLikePattern } from "@domain-slayer/shared";
import type { EntityManager, Repository } from "typeorm";
import { Brackets, In } from "typeorm";
import { DocumentEntity } from "../entities/document.entity.js";
import { SiteEntity } from "../entities/site.entity.js";
import { mapDocumentEntityToDomain } from "../mappers/document.mapper.js";
import { spanishAccentFoldExpr } from "../sql-accent-fold.js";

function foldField(alias: string, col: string): string {
  return spanishAccentFoldExpr(`COALESCE(${alias}.${col},'')`);
}

export class SqlDocumentRepository implements DocumentRepository {
  constructor(private readonly em: EntityManager) {}

  private get repo(): Repository<DocumentEntity> {
    return this.em.getRepository(DocumentEntity);
  }

  async create(input: SiteDocumentCreateInput): Promise<SiteDocument> {
    const embeddedMediaJson =
      input.embeddedMedia != null && input.embeddedMedia.length > 0
        ? JSON.stringify(input.embeddedMedia)
        : null;
    const row = this.repo.create({
      id: createId(),
      siteId: input.siteId ?? null,
      documentType: input.documentType,
      title: input.title,
      description: input.description ?? null,
      searchText: input.searchText ?? null,
      embeddedMediaJson,
      filePath: input.filePath ?? null,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      uploadedBy: input.uploadedBy ?? null,
      createdAt: new Date(),
    });
    const saved = await this.repo.save(row);
    return mapDocumentEntityToDomain(saved);
  }

  async update(id: string, input: SiteDocumentUpdateInput): Promise<SiteDocument | null> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) return null;
    if (input.documentType !== undefined) existing.documentType = input.documentType;
    if (input.title !== undefined) existing.title = input.title;
    if (input.description !== undefined) existing.description = input.description;
    if (input.searchText !== undefined) existing.searchText = input.searchText;
    if (input.embeddedMedia !== undefined) {
      existing.embeddedMediaJson =
        input.embeddedMedia != null && input.embeddedMedia.length > 0
          ? JSON.stringify(input.embeddedMedia)
          : null;
    }
    if (input.filePath !== undefined) existing.filePath = input.filePath;
    if (input.fileName !== undefined) existing.fileName = input.fileName;
    if (input.mimeType !== undefined) existing.mimeType = input.mimeType;
    if (input.fileSizeBytes !== undefined) existing.fileSizeBytes = input.fileSizeBytes;
    const saved = await this.repo.save(existing);
    return mapDocumentEntityToDomain(saved);
  }

  async findById(id: string): Promise<SiteDocument | null> {
    const e = await this.repo.findOne({ where: { id } });
    return e ? mapDocumentEntityToDomain(e) : null;
  }

  async listBySiteId(siteId: string): Promise<SiteDocument[]> {
    const rows = await this.repo.find({ where: { siteId }, order: { createdAt: "DESC" } });
    return rows.map(mapDocumentEntityToDomain);
  }

  async listAll(opts: { limit: number; offset: number }): Promise<{ items: SiteDocument[]; total: number }> {
    const total = await this.repo.count();
    const rows = await this.repo.find({
      order: { createdAt: "DESC" },
      skip: opts.offset,
      take: opts.limit,
    });
    return { items: rows.map(mapDocumentEntityToDomain), total };
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected ?? 0) > 0;
  }

  async searchLibrary(
    tokens: string[],
    opts: { limit: number; offset: number; match?: "all" | "any" }
  ): Promise<{ items: DocumentSearchHit[]; total: number }> {
    if (tokens.length === 0) {
      return { items: [], total: 0 };
    }

    const matchMode = opts.match ?? "any";
    const qb = this.repo.createQueryBuilder("d").leftJoin(SiteEntity, "s", "s.id = d.siteId");
    let pidx = 0;

    const oneTokenBracket = (token: string) => {
      const like = `%${escapeSqlLikePattern(token)}%`;
      const p = `kw${pidx++}`;
      return new Brackets((q) => {
        q.where(`${foldField("d", "title")} LIKE :${p} ESCAPE '\\'`, { [p]: like })
          .orWhere(`${foldField("d", "description")} LIKE :${p} ESCAPE '\\'`, { [p]: like })
          .orWhere(`${foldField("d", "searchText")} LIKE :${p} ESCAPE '\\'`, { [p]: like })
          .orWhere(`${foldField("d", "fileName")} LIKE :${p} ESCAPE '\\'`, { [p]: like })
          .orWhere(`${foldField("s", "siteName")} LIKE :${p} ESCAPE '\\'`, { [p]: like })
          .orWhere(`${foldField("s", "domain")} LIKE :${p} ESCAPE '\\'`, { [p]: like });
      });
    };

    if (matchMode === "any") {
      qb.andWhere(
        new Brackets((outer) => {
          tokens.forEach((token, i) => {
            const b = oneTokenBracket(token);
            if (i === 0) outer.where(b);
            else outer.orWhere(b);
          });
        })
      );
    } else {
      for (const token of tokens) {
        qb.andWhere(oneTokenBracket(token));
      }
    }

    const total = await qb.clone().getCount();
    const rows = await qb
      .orderBy("d.createdAt", "DESC")
      .skip(opts.offset)
      .take(opts.limit)
      .getMany();

    const siteIds = [...new Set(rows.map((r) => r.siteId).filter((id): id is string => id != null && id !== ""))];
    const sites = siteIds.length
      ? await this.em.getRepository(SiteEntity).findBy({ id: In(siteIds) })
      : [];
    const sm = new Map(sites.map((s) => [s.id, s]));

    const items: DocumentSearchHit[] = rows.map((e) => {
      const doc = mapDocumentEntityToDomain(e);
      const s = e.siteId ? sm.get(e.siteId) : undefined;
      return {
        document: doc,
        siteName: s?.siteName ?? "Biblioteca global",
        domain: s?.domain ?? "—",
        snippet: buildLibrarySearchSnippet(doc, tokens),
      };
    });

    return { items, total };
  }
}

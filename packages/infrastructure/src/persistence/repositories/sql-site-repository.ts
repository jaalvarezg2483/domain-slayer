import { createId } from "@paralleldrive/cuid2";
import type { Site, SiteCreateInput, SiteUpdateInput } from "@domain-slayer/domain";
import type { SiteRepository, SiteListFilter } from "@domain-slayer/application";
import { computeDomainExpiryFinal, computeSslExpiryFinal, resolveSslExpirySource } from "@domain-slayer/application";
import { escapeSqlLikePattern, tokenizeSearchQuery } from "@domain-slayer/shared";
import type { EntityManager, Repository } from "typeorm";
import { Brackets } from "typeorm";
import { SiteEntity } from "../entities/site.entity.js";
import { mapSiteEntityToDomain } from "../mappers/site.mapper.js";
import { spanishAccentFoldExpr } from "../sql-accent-fold.js";

/** Propiedades de SiteEntity donde aplica búsqueda por texto (acentos colapsados en SQL). */
const SITE_SEARCH_FIELDS = [
  "siteName",
  "domain",
  "url",
  "notes",
  "sslResolutionNotes",
  "domainResolutionNotes",
  "businessUnit",
  "owner",
  "technicalOwner",
  "contactEmail",
  "provider",
  "hostingProvider",
  "dnsProvider",
  "sslProvider",
  "registrarProvider",
] as const;

function foldSiteCol(prop: (typeof SITE_SEARCH_FIELDS)[number]): string {
  return spanishAccentFoldExpr(`COALESCE(s.${prop},'')`);
}

export class SqlSiteRepository implements SiteRepository {
  constructor(private readonly em: EntityManager) {}

  private get repo(): Repository<SiteEntity> {
    return this.em.getRepository(SiteEntity);
  }

  async create(input: SiteCreateInput): Promise<Site> {
    const now = new Date();
    const source = input.domainExpirySource ?? "unavailable";
    const finalExpiry = computeDomainExpiryFinal(null, input.domainExpiryManual ?? null, source);
    const sslSource = resolveSslExpirySource(input.sslValidToManual ?? null, input.sslExpirySource);
    const sslFinal = computeSslExpiryFinal(null, input.sslValidToManual ?? null, sslSource);
    const row = this.repo.create({
      id: createId(),
      siteName: input.siteName,
      businessUnit: input.businessUnit ?? null,
      domain: input.domain,
      url: input.url,
      environment: input.environment,
      provider: input.provider ?? null,
      hostingProvider: input.hostingProvider ?? null,
      dnsProvider: input.dnsProvider ?? null,
      sslProvider: input.sslProvider ?? null,
      registrarProvider: input.registrarProvider ?? null,
      owner: input.owner ?? null,
      technicalOwner: input.technicalOwner ?? null,
      contactEmail: input.contactEmail ?? null,
      notes: input.notes ?? null,
      sslResolutionNotes: null,
      domainResolutionNotes: null,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
      domainExpiryAuto: null,
      domainExpiryManual: input.domainExpiryManual ?? null,
      domainExpiryFinal: finalExpiry,
      domainExpirySource: source,
      domainExpiryStatus: "unknown",
      domainStatus: "unknown",
      dnsStatus: "unknown",
      nameserversJson: null,
      aRecordsJson: null,
      aaaaRecordsJson: null,
      cnameRecordsJson: null,
      mxRecordsJson: null,
      soaRecordJson: null,
      httpStatus: "unknown",
      httpsStatus: "unknown",
      sslSubject: null,
      sslIssuer: null,
      sslValidFrom: null,
      sslValidTo: null,
      sslValidToManual: input.sslValidToManual ?? null,
      sslExpirySource: sslSource,
      sslValidToFinal: sslFinal,
      sslSerialNumber: null,
      sslStatus: "unknown",
      sslHostnameMatch: null,
      lastCheckedAt: null,
      checkStatus: "success",
      healthStatus: "unknown",
    });
    const saved = await this.repo.save(row);
    return mapSiteEntityToDomain(saved);
  }

  async update(id: string, input: SiteUpdateInput): Promise<Site | null> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) return null;
    if (input.siteName !== undefined) existing.siteName = input.siteName;
    if (input.businessUnit !== undefined) existing.businessUnit = input.businessUnit;
    if (input.domain !== undefined) existing.domain = input.domain;
    if (input.url !== undefined) existing.url = input.url;
    if (input.environment !== undefined) existing.environment = input.environment;
    if (input.provider !== undefined) existing.provider = input.provider;
    if (input.hostingProvider !== undefined) existing.hostingProvider = input.hostingProvider;
    if (input.dnsProvider !== undefined) existing.dnsProvider = input.dnsProvider;
    if (input.sslProvider !== undefined) existing.sslProvider = input.sslProvider;
    if (input.registrarProvider !== undefined) existing.registrarProvider = input.registrarProvider;
    if (input.owner !== undefined) existing.owner = input.owner;
    if (input.technicalOwner !== undefined) existing.technicalOwner = input.technicalOwner;
    if (input.contactEmail !== undefined) existing.contactEmail = input.contactEmail;
    if (input.notes !== undefined) existing.notes = input.notes;
    if (input.sslResolutionNotes !== undefined) existing.sslResolutionNotes = input.sslResolutionNotes;
    if (input.domainResolutionNotes !== undefined) existing.domainResolutionNotes = input.domainResolutionNotes;
    if (input.isActive !== undefined) existing.isActive = input.isActive;
    if (input.domainExpiryManual !== undefined) existing.domainExpiryManual = input.domainExpiryManual;
    if (input.domainExpirySource !== undefined) existing.domainExpirySource = input.domainExpirySource;
    if (input.sslValidToManual !== undefined) existing.sslValidToManual = input.sslValidToManual;
    if (input.sslExpirySource !== undefined) existing.sslExpirySource = input.sslExpirySource;
    existing.updatedAt = new Date();
    existing.domainExpiryFinal = computeDomainExpiryFinal(
      existing.domainExpiryAuto,
      existing.domainExpiryManual,
      existing.domainExpirySource as Site["domainExpirySource"]
    );
    existing.sslValidToFinal = computeSslExpiryFinal(
      existing.sslValidTo,
      existing.sslValidToManual,
      existing.sslExpirySource as Site["sslExpirySource"]
    );
    const saved = await this.repo.save(existing, { reload: true });
    return mapSiteEntityToDomain(saved);
  }

  async findById(id: string): Promise<Site | null> {
    const e = await this.repo.findOne({ where: { id } });
    return e ? mapSiteEntityToDomain(e) : null;
  }

  async findByDomain(domain: string): Promise<Site | null> {
    const e = await this.repo.findOne({ where: { domain: domain.toLowerCase() } });
    return e ? mapSiteEntityToDomain(e) : null;
  }

  async list(filter: SiteListFilter): Promise<{ items: Site[]; total: number }> {
    const qb = this.repo.createQueryBuilder("s");
    if (filter.search?.trim()) {
      let tokens = tokenizeSearchQuery(filter.search);
      if (tokens.length === 0) {
        if (filter.strictTextSearch) {
          qb.andWhere("1 = 0");
        } else {
          const t = filter.search.trim();
          if (t.length >= 2) tokens = [t];
        }
      }
      if (tokens.length > 0) {
        let pidx = 0;
        const bracketForToken = (token: string) => {
          const trimmed = token.trim();
          if (!trimmed) return null;
          const like = `%${escapeSqlLikePattern(trimmed)}%`;
          const p = `st${pidx++}`;
          return new Brackets((q) => {
            q.where(`${foldSiteCol("siteName")} LIKE :${p} ESCAPE '\\'`, { [p]: like });
            for (const col of SITE_SEARCH_FIELDS.slice(1)) {
              q.orWhere(`${foldSiteCol(col)} LIKE :${p} ESCAPE '\\'`, { [p]: like });
            }
          });
        };
        const tokenBrackets = tokens.map(bracketForToken).filter((b): b is Brackets => b != null);
        if (tokenBrackets.length > 0) {
          const matchAll = filter.searchMatch === "all";
          if (matchAll) {
            for (const b of tokenBrackets) {
              qb.andWhere(b);
            }
          } else {
            qb.andWhere(
              new Brackets((outer) => {
                tokenBrackets.forEach((b, i) => {
                  if (i === 0) outer.where(b);
                  else outer.orWhere(b);
                });
              })
            );
          }
        }
      }
    }
    if (filter.environment) qb.andWhere("s.environment = :env", { env: filter.environment });
    if (filter.isActive !== undefined) qb.andWhere("s.isActive = :active", { active: filter.isActive });
    if (filter.healthStatus) qb.andWhere("s.healthStatus = :hs", { hs: filter.healthStatus });
    const total = await qb.clone().getCount();
    const limit = Math.min(filter.limit ?? 50, 500);
    const offset = filter.offset ?? 0;
    qb.orderBy("s.updatedAt", "DESC").skip(offset).take(limit);
    const rows = await qb.getMany();
    return { items: rows.map(mapSiteEntityToDomain), total };
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected ?? 0) > 0;
  }

  async updateOperationalFields(
    id: string,
    fields: Parameters<SiteRepository["updateOperationalFields"]>[1]
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) return;
    Object.assign(existing, fields);
    existing.updatedAt = new Date();
    if (
      fields.domainExpiryAuto !== undefined ||
      fields.domainExpiryManual !== undefined ||
      fields.domainExpirySource !== undefined
    ) {
      existing.domainExpiryFinal = computeDomainExpiryFinal(
        existing.domainExpiryAuto,
        existing.domainExpiryManual,
        existing.domainExpirySource as Site["domainExpirySource"]
      );
    }
    if (
      fields.sslValidTo !== undefined ||
      fields.sslValidToManual !== undefined ||
      fields.sslExpirySource !== undefined ||
      fields.sslValidToFinal !== undefined
    ) {
      existing.sslValidToFinal = computeSslExpiryFinal(
        existing.sslValidTo,
        existing.sslValidToManual,
        existing.sslExpirySource as Site["sslExpirySource"]
      );
    }
    await this.repo.save(existing);
  }
}

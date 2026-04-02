import { createId } from "@paralleldrive/cuid2";
import type { Site, SiteCreateInput, SiteUpdateInput } from "@domain-slayer/domain";
import { NotFoundError, ValidationError } from "@domain-slayer/shared";
import type { SiteRepository, SiteListFilter } from "../ports/site-repository.js";
import { createSiteSchema, updateSiteSchema } from "../dto/site-dto.js";
import { resolveDomainExpirySource } from "./site-domain-expiry.js";
import { resolveSslExpirySource } from "./site-ssl-expiry.js";

export class SiteService {
  constructor(private readonly sites: SiteRepository) {}

  async create(raw: unknown): Promise<Site> {
    const parsed = createSiteSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError("Datos de sitio inválidos", parsed.error.flatten());
    }
    const dto = parsed.data;
    const existing = await this.sites.findByDomain(dto.domain);
    if (existing) {
      throw new ValidationError(`Ya existe un sitio con el dominio ${dto.domain}`);
    }
    const source = resolveDomainExpirySource(dto.domainExpiryManual ?? null, dto.domainExpirySource);
    const sslSource = resolveSslExpirySource(dto.sslValidToManual ?? null, dto.sslExpirySource);
    const input: SiteCreateInput = {
      siteName: dto.siteName,
      businessUnit: dto.businessUnit ?? null,
      domain: dto.domain,
      url: dto.url,
      environment: dto.environment,
      provider: dto.provider ?? null,
      hostingProvider: dto.hostingProvider ?? null,
      dnsProvider: dto.dnsProvider ?? null,
      sslProvider: dto.sslProvider ?? null,
      registrarProvider: dto.registrarProvider ?? null,
      owner: dto.owner ?? null,
      technicalOwner: dto.technicalOwner ?? null,
      contactEmail: dto.contactEmail ?? null,
      notes: dto.notes ?? null,
      isActive: dto.isActive ?? true,
      domainExpiryManual: dto.domainExpiryManual ?? null,
      domainExpirySource: source,
      sslValidToManual: dto.sslValidToManual ?? null,
      sslExpirySource: sslSource,
    };
    return this.sites.create(input);
  }

  async update(id: string, raw: unknown): Promise<Site> {
    const parsed = updateSiteSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError("Datos de actualización inválidos", parsed.error.flatten());
    }
    const dto = parsed.data;
    const current = await this.sites.findById(id);
    if (!current) throw new NotFoundError("Sitio", id);
    if (dto.domain && dto.domain !== current.domain) {
      const clash = await this.sites.findByDomain(dto.domain);
      if (clash) throw new ValidationError(`Dominio ya en uso: ${dto.domain}`);
    }
    const manual = dto.domainExpiryManual !== undefined ? dto.domainExpiryManual : current.domainExpiryManual;
    const sourceHint = dto.domainExpirySource !== undefined ? dto.domainExpirySource : current.domainExpirySource;
    const source = resolveDomainExpirySource(manual, sourceHint);
    const sslManual = dto.sslValidToManual !== undefined ? dto.sslValidToManual : current.sslValidToManual;
    const sslSourceHint = dto.sslExpirySource !== undefined ? dto.sslExpirySource : current.sslExpirySource;
    const sslSource = resolveSslExpirySource(sslManual, sslSourceHint);
    const update: SiteUpdateInput = {
      ...dto,
      domainExpirySource: source,
      sslExpirySource: sslSource,
    };
    const updated = await this.sites.update(id, update);
    if (!updated) throw new NotFoundError("Sitio", id);
    return updated;
  }

  getById(id: string) {
    return this.sites.findById(id);
  }

  list(filter: SiteListFilter) {
    return this.sites.list(filter);
  }

  async delete(id: string) {
    const ok = await this.sites.delete(id);
    if (!ok) throw new NotFoundError("Sitio", id);
  }
}

export function newSiteId(): string {
  return createId();
}

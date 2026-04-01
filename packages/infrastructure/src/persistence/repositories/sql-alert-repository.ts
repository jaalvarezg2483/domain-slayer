import { createId } from "@paralleldrive/cuid2";
import type { Alert } from "@domain-slayer/domain";
import type { AlertRepository, AlertListFilter } from "@domain-slayer/application";
import { In, type EntityManager, type Repository } from "typeorm";
import { AlertEntity } from "../entities/alert.entity.js";
import { mapAlertEntityToDomain } from "../mappers/alert.mapper.js";

export class SqlAlertRepository implements AlertRepository {
  constructor(private readonly em: EntityManager) {}

  private get repo(): Repository<AlertEntity> {
    return this.em.getRepository(AlertEntity);
  }

  async create(input: Omit<Alert, "id" | "createdAt">): Promise<Alert> {
    const row = this.repo.create({
      id: createId(),
      ...input,
      createdAt: new Date(),
    });
    const saved = await this.repo.save(row);
    return mapAlertEntityToDomain(saved);
  }

  async list(filter: AlertListFilter): Promise<{ items: Alert[]; total: number }> {
    const qb = this.repo.createQueryBuilder("a");
    if (filter.siteId) qb.andWhere("a.siteId = :sid", { sid: filter.siteId });
    if (filter.isResolved !== undefined) qb.andWhere("a.isResolved = :r", { r: filter.isResolved });
    const total = await qb.clone().getCount();
    const limit = Math.min(filter.limit ?? 50, 500);
    const offset = filter.offset ?? 0;
    qb.orderBy("a.createdAt", "DESC").skip(offset).take(limit);
    const rows = await qb.getMany();
    return { items: rows.map(mapAlertEntityToDomain), total };
  }

  async markRead(id: string): Promise<void> {
    await this.repo.update({ id }, { isRead: true });
  }

  async resolve(id: string): Promise<void> {
    await this.repo.update({ id }, { isResolved: true, isRead: true });
  }

  async resolveAllOpen(): Promise<{ count: number }> {
    const result = await this.repo.update({ isResolved: false }, { isResolved: true, isRead: true });
    return { count: result.affected ?? 0 };
  }

  async resolveOpenForSiteAndTypes(siteId: string, alertTypes: readonly string[]): Promise<{ count: number }> {
    if (alertTypes.length === 0) return { count: 0 };
    const result = await this.repo.update(
      { siteId, isResolved: false, alertType: In([...alertTypes]) },
      { isResolved: true, isRead: true }
    );
    return { count: result.affected ?? 0 };
  }
}

import { createId } from "@paralleldrive/cuid2";
import type { CheckHistoryEntry } from "@domain-slayer/domain";
import type { CheckHistoryRepository } from "@domain-slayer/application";
import type { EntityManager, Repository } from "typeorm";
import { CheckHistoryEntity } from "../entities/check-history.entity.js";
import { mapCheckHistoryEntityToDomain } from "../mappers/check-history.mapper.js";

export class SqlCheckHistoryRepository implements CheckHistoryRepository {
  constructor(private readonly em: EntityManager) {}

  private get repo(): Repository<CheckHistoryEntity> {
    return this.em.getRepository(CheckHistoryEntity);
  }

  async append(entry: Omit<CheckHistoryEntry, "id">): Promise<CheckHistoryEntry> {
    const row = this.repo.create({
      id: createId(),
      ...entry,
    });
    const saved = await this.repo.save(row);
    return mapCheckHistoryEntityToDomain(saved);
  }

  async listBySiteId(
    siteId: string,
    limit: number,
    offset: number
  ): Promise<{ items: CheckHistoryEntry[]; total: number }> {
    const total = await this.repo.count({ where: { siteId } });
    const rows = await this.repo.find({
      where: { siteId },
      order: { checkedAt: "DESC" },
      take: limit,
      skip: offset,
    });
    return { items: rows.map(mapCheckHistoryEntityToDomain), total };
  }
}

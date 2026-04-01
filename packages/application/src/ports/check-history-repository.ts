import type { CheckHistoryEntry } from "@domain-slayer/domain";

export interface CheckHistoryRepository {
  append(entry: Omit<CheckHistoryEntry, "id">): Promise<CheckHistoryEntry>;
  listBySiteId(siteId: string, limit: number, offset: number): Promise<{ items: CheckHistoryEntry[]; total: number }>;
}

import { and, eq } from 'drizzle-orm';
import { appUserPeriodStatus } from '../schema.js';
import type { Database } from '../db.js';

export type UserPeriodVigencia = 'active' | 'inactive';

export class AppUserPeriodStatusRepository {
  constructor(private db: Database) {}

  getRow(userId: number, periodId: number) {
    return this.db
      .select()
      .from(appUserPeriodStatus)
      .where(and(eq(appUserPeriodStatus.userId, userId), eq(appUserPeriodStatus.periodId, periodId)))
      .get();
  }

  /** Sin fila en BD = activo (comportamiento por defecto). */
  getEffectiveStatus(userId: number, periodId: number): UserPeriodVigencia {
    const row = this.getRow(userId, periodId);
    if (!row) return 'active';
    return row.status as UserPeriodVigencia;
  }

  setStatus(userId: number, periodId: number, status: UserPeriodVigencia) {
    const now = new Date();
    if (status === 'active') {
      this.db
        .delete(appUserPeriodStatus)
        .where(and(eq(appUserPeriodStatus.userId, userId), eq(appUserPeriodStatus.periodId, periodId)))
        .run();
      return;
    }
    const existing = this.getRow(userId, periodId);
    if (existing) {
      this.db
        .update(appUserPeriodStatus)
        .set({ status: 'inactive', updatedAt: now })
        .where(eq(appUserPeriodStatus.id, existing.id))
        .run();
      return;
    }
    this.db
      .insert(appUserPeriodStatus)
      .values({
        userId,
        periodId,
        status: 'inactive',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

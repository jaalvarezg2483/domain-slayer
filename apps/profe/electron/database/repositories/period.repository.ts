import { eq, and, asc } from 'drizzle-orm';
import { periods } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class PeriodRepository {
  constructor(private db: Database) {}

  private ownerEq(scope: DataScope) {
    return eq(periods.ownerUserId, scope.userId);
  }

  getAll(scope: DataScope) {
    const o = this.ownerEq(scope);
    return this.db.select().from(periods).where(o).orderBy(asc(periods.year), asc(periods.type)).all();
  }

  getById(scope: DataScope, id: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(periods).where(and(eq(periods.id, id), o)).get();
  }

  getByYear(scope: DataScope, year: string) {
    const o = this.ownerEq(scope);
    return this.db.select().from(periods).where(and(eq(periods.year, year), o)).orderBy(asc(periods.type)).all();
  }

  getByType(scope: DataScope, type: 'trimestral' | 'semestral') {
    const o = this.ownerEq(scope);
    return this.db.select().from(periods).where(and(eq(periods.type, type), o)).orderBy(asc(periods.year)).all();
  }

  getByTypeAndYear(scope: DataScope, type: 'trimestral' | 'semestral', year: string) {
    const o = this.ownerEq(scope);
    return this.db
      .select()
      .from(periods)
      .where(and(eq(periods.type, type), eq(periods.year, year), o))
      .get();
  }

  create(data: {
    year: string;
    type: 'trimestral' | 'semestral';
    startDate: Date;
    endDate: Date;
    ownerUserId: number;
  }) {
    const now = new Date();
    return this.db
      .insert(periods)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(scope: DataScope, id: number, data: Partial<typeof periods.$inferInsert>) {
    if (!this.getById(scope, id)) return undefined;
    return this.db
      .update(periods)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(periods.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    if (!this.getById(scope, id)) return { changes: 0 };
    return this.db.delete(periods).where(eq(periods.id, id)).run();
  }
}

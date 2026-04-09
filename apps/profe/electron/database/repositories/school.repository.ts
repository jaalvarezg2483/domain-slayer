import { eq, and } from 'drizzle-orm';
import { schools } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class SchoolRepository {
  constructor(private db: Database) {}

  private ownerEq(scope: DataScope) {
    return eq(schools.ownerUserId, scope.userId);
  }

  getAll(scope: DataScope) {
    const o = this.ownerEq(scope);
    return this.db.select().from(schools).where(o).all();
  }

  getById(scope: DataScope, id: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(schools).where(and(eq(schools.id, id), o)).get();
  }

  create(data: {
    name: string;
    logoPath?: string;
    reportHeader?: string;
    reportFooter?: string;
    ownerUserId: number;
  }) {
    const now = new Date();
    return this.db
      .insert(schools)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(scope: DataScope, id: number, data: Partial<typeof schools.$inferInsert>) {
    if (!this.getById(scope, id)) return undefined;
    return this.db
      .update(schools)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    if (!this.getById(scope, id)) return { changes: 0 };
    return this.db.delete(schools).where(eq(schools.id, id)).run();
  }
}

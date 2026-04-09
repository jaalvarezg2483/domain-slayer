import { eq, and } from 'drizzle-orm';
import { groups } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class GroupRepository {
  constructor(private db: Database) {}

  private ownerEq(scope: DataScope) {
    return eq(groups.ownerUserId, scope.userId);
  }

  getAll(scope: DataScope) {
    const o = this.ownerEq(scope);
    return this.db.select().from(groups).where(o).all();
  }

  getById(scope: DataScope, id: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(groups).where(and(eq(groups.id, id), o)).get();
  }

  getBySchoolId(scope: DataScope, schoolId: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(groups).where(and(eq(groups.schoolId, schoolId), o)).all();
  }

  create(data: {
    name: string;
    type?: string;
    level?: string;
    section?: string;
    career?: string;
    schoolId?: number;
    ownerUserId: number;
  }) {
    const now = new Date();
    return this.db
      .insert(groups)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(scope: DataScope, id: number, data: Partial<typeof groups.$inferInsert>) {
    if (!this.getById(scope, id)) return undefined;
    return this.db
      .update(groups)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    if (!this.getById(scope, id)) return { changes: 0 };
    return this.db.delete(groups).where(eq(groups.id, id)).run();
  }
}

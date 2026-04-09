import { eq, and } from 'drizzle-orm';
import { courses } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class CourseRepository {
  constructor(private db: Database) {}

  private ownerEq(scope: DataScope) {
    return eq(courses.ownerUserId, scope.userId);
  }

  canAccess(scope: DataScope, courseId: number): boolean {
    const row = this.db.select().from(courses).where(eq(courses.id, courseId)).get();
    if (!row) return false;
    return row.ownerUserId === scope.userId;
  }

  getAll(scope: DataScope) {
    const o = this.ownerEq(scope);
    return this.db.select().from(courses).where(o).all();
  }

  getById(scope: DataScope, id: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(courses).where(and(eq(courses.id, id), o)).get();
  }

  getByGroupId(scope: DataScope, groupId: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(courses).where(and(eq(courses.groupId, groupId), o)).all();
  }

  getByPeriodId(scope: DataScope, periodId: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(courses).where(and(eq(courses.periodId, periodId), o)).all();
  }

  create(data: {
    name: string;
    description?: string;
    section?: string;
    groupId: number;
    periodId: number;
    gradeDistributionId?: number | null;
    ownerUserId: number;
  }) {
    const now = new Date();
    return this.db
      .insert(courses)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(scope: DataScope, id: number, data: Partial<typeof courses.$inferInsert>) {
    if (!this.getById(scope, id)) return undefined;
    return this.db
      .update(courses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    if (!this.getById(scope, id)) return { changes: 0 };
    return this.db.delete(courses).where(eq(courses.id, id)).run();
  }
}

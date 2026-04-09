import { eq, and } from 'drizzle-orm';
import { gradeDistributions, gradeDistributionCategories } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class GradeDistributionRepository {
  constructor(private db: Database) {}

  private ownerEq(scope: DataScope) {
    return eq(gradeDistributions.ownerUserId, scope.userId);
  }

  getAll(scope: DataScope) {
    const o = this.ownerEq(scope);
    const distributions = this.db.select().from(gradeDistributions).where(o).all();
    return distributions.map((dist) => {
      const categories = this.db
        .select()
        .from(gradeDistributionCategories)
        .where(eq(gradeDistributionCategories.distributionId, dist.id))
        .all();
      return {
        ...dist,
        categories,
      };
    });
  }

  getById(scope: DataScope, id: number) {
    const o = this.ownerEq(scope);
    return this.db.select().from(gradeDistributions).where(and(eq(gradeDistributions.id, id), o)).get();
  }

  getWithCategories(scope: DataScope, id: number) {
    const distribution = this.getById(scope, id);
    if (!distribution) return null;

    const categories = this.db
      .select()
      .from(gradeDistributionCategories)
      .where(eq(gradeDistributionCategories.distributionId, id))
      .all();

    return {
      ...distribution,
      categories,
    };
  }

  create(data: {
    name: string;
    description?: string;
    ownerUserId: number;
    categories: Array<{ name: string; percentage: number }>;
  }) {
    const now = new Date();

    const totalPercentage = data.categories.reduce((sum, cat) => sum + cat.percentage, 0);
    if (totalPercentage !== 100) {
      throw new Error(`Los porcentajes deben sumar 100%. Actual: ${totalPercentage}%`);
    }

    const distribution = this.db
      .insert(gradeDistributions)
      .values({
        name: data.name,
        description: data.description,
        ownerUserId: data.ownerUserId,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const categories = data.categories.map((cat) =>
      this.db
        .insert(gradeDistributionCategories)
        .values({
          distributionId: distribution.id,
          name: cat.name,
          percentage: cat.percentage,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get(),
    );

    return {
      ...distribution,
      categories,
    };
  }

  update(scope: DataScope, id: number, data: {
    name?: string;
    description?: string;
    categories?: Array<{ name: string; percentage: number }>;
  }) {
    if (!this.getById(scope, id)) return undefined;
    const now = new Date();

    if (data.categories) {
      const totalPercentage = data.categories.reduce((sum, cat) => sum + cat.percentage, 0);
      if (totalPercentage !== 100) {
        throw new Error(`Los porcentajes deben sumar 100%. Actual: ${totalPercentage}%`);
      }

      this.db.delete(gradeDistributionCategories).where(eq(gradeDistributionCategories.distributionId, id)).run();

      data.categories.forEach((cat) =>
        this.db
          .insert(gradeDistributionCategories)
          .values({
            distributionId: id,
            name: cat.name,
            percentage: cat.percentage,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      );
    }

    return this.db
      .update(gradeDistributions)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        updatedAt: now,
      })
      .where(eq(gradeDistributions.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    if (!this.getById(scope, id)) return { changes: 0 };
    return this.db.delete(gradeDistributions).where(eq(gradeDistributions.id, id)).run();
  }
}

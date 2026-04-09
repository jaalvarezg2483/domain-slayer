import { eq, and } from 'drizzle-orm';
import { rubrics, rubricCriteria, rubricSubCriteria, activityTypes } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class RubricRepository {
  constructor(private db: Database) {}

  private ownerEq(scope: DataScope) {
    return eq(rubrics.ownerUserId, scope.userId);
  }

  getAll(scope: DataScope) {
    const o = this.ownerEq(scope);
    const allRubrics = this.db.select().from(rubrics).where(o).all();
    return allRubrics.map(rubric => {
      const criteria = this.db
        .select()
        .from(rubricCriteria)
        .where(eq(rubricCriteria.rubricId, rubric.id))
        .all()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(criterion => {
          const subCriteria = this.db
            .select()
            .from(rubricSubCriteria)
            .where(eq(rubricSubCriteria.criterionId, criterion.id))
            .all()
            .sort((a, b) => a.orderIndex - b.orderIndex);
          return {
            ...criterion,
            subCriteria,
          };
        });
      const activityType = rubric.activityTypeId
        ? this.db.select().from(activityTypes).where(eq(activityTypes.id, rubric.activityTypeId)).get()
        : null;
      return {
        ...rubric,
        criteria,
        activityType,
      };
    });
  }

  getById(scope: DataScope, id: number) {
    const o = this.ownerEq(scope);
    const rubric = this.db.select().from(rubrics).where(and(eq(rubrics.id, id), o)).get();
    if (!rubric) return null;

    const criteria = this.db
      .select()
      .from(rubricCriteria)
      .where(eq(rubricCriteria.rubricId, id))
      .all()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(criterion => {
        const subCriteria = this.db
          .select()
          .from(rubricSubCriteria)
          .where(eq(rubricSubCriteria.criterionId, criterion.id))
          .all()
          .sort((a, b) => a.orderIndex - b.orderIndex);
        return {
          ...criterion,
          subCriteria,
        };
      });

    const activityType = rubric.activityTypeId
      ? this.db.select().from(activityTypes).where(eq(activityTypes.id, rubric.activityTypeId)).get()
      : null;

    return {
      ...rubric,
      criteria,
      activityType,
    };
  }

  getByActivityTypeId(scope: DataScope, activityTypeId: number) {
    const o = this.ownerEq(scope);
    const w = and(eq(rubrics.activityTypeId, activityTypeId), o);
    const allRubrics = this.db.select().from(rubrics).where(w).all();
    return allRubrics.map(rubric => {
      const criteria = this.db
        .select()
        .from(rubricCriteria)
        .where(eq(rubricCriteria.rubricId, rubric.id))
        .all()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(criterion => {
          const subCriteria = this.db
            .select()
            .from(rubricSubCriteria)
            .where(eq(rubricSubCriteria.criterionId, criterion.id))
            .all()
            .sort((a, b) => a.orderIndex - b.orderIndex);
          return {
            ...criterion,
            subCriteria,
          };
        });
      return {
        ...rubric,
        criteria,
      };
    });
  }

  getTemplates(scope: DataScope) {
    const o = this.ownerEq(scope);
    const w = and(eq(rubrics.isTemplate, true), o);
    const allRubrics = this.db.select().from(rubrics).where(w).all();
    return allRubrics.map(rubric => {
      const criteria = this.db
        .select()
        .from(rubricCriteria)
        .where(eq(rubricCriteria.rubricId, rubric.id))
        .all()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(criterion => {
          const subCriteria = this.db
            .select()
            .from(rubricSubCriteria)
            .where(eq(rubricSubCriteria.criterionId, criterion.id))
            .all()
            .sort((a, b) => a.orderIndex - b.orderIndex);
          return {
            ...criterion,
            subCriteria,
          };
        });
      const activityType = rubric.activityTypeId
        ? this.db.select().from(activityTypes).where(eq(activityTypes.id, rubric.activityTypeId)).get()
        : null;
      return {
        ...rubric,
        criteria,
        activityType,
      };
    });
  }

    create(scope: DataScope, data: {
      name: string;
      description?: string;
      activityTypeId?: number;
      totalPoints: number;
      isTemplate?: boolean;
      ownerUserId: number;
      criteria: Array<{ 
        name: string; 
        description?: string; 
        points: number; 
        orderIndex: number;
        subCriteria?: Array<{ name: string; description?: string; points: number; orderIndex: number }>;
      }>;
    }) {
    const now = new Date();

    // Validar que la suma de puntos de los criterios coincida con totalPoints
    const totalCriteriaPoints = data.criteria.reduce((sum, crit) => sum + crit.points, 0);
    if (totalCriteriaPoints !== data.totalPoints) {
      throw new Error(
        `La suma de puntos de los criterios (${totalCriteriaPoints}) debe coincidir con el total de puntos (${data.totalPoints})`
      );
    }

      // Crear la rúbrica
      const rubric = this.db
        .insert(rubrics)
        .values({
          name: data.name,
          description: data.description,
          activityTypeId: data.activityTypeId,
          totalPoints: data.totalPoints,
          isTemplate: data.isTemplate || false,
          ownerUserId: data.ownerUserId,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

    // Crear los criterios y sus subcriterios
    if (data.criteria.length > 0) {
      for (const crit of data.criteria) {
        // Validar que la suma de subcriterios coincida con los puntos del criterio
        if (crit.subCriteria && crit.subCriteria.length > 0) {
          const totalSubCriteriaPoints = crit.subCriteria.reduce((sum, sub) => sum + sub.points, 0);
          if (totalSubCriteriaPoints !== crit.points) {
            throw new Error(
              `En el criterio "${crit.name}": La suma de puntos de los subcriterios (${totalSubCriteriaPoints}) debe coincidir con los puntos del criterio (${crit.points})`
            );
          }
        }

        const createdCriterion = this.db
          .insert(rubricCriteria)
          .values({
            rubricId: rubric.id,
            name: crit.name,
            description: crit.description,
            points: crit.points,
            orderIndex: crit.orderIndex,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get();

        // Crear subcriterios si existen
        if (crit.subCriteria && crit.subCriteria.length > 0) {
          this.db
            .insert(rubricSubCriteria)
            .values(
              crit.subCriteria.map((subCrit) => ({
                criterionId: createdCriterion.id,
                name: subCrit.name,
                description: subCrit.description,
                points: subCrit.points,
                orderIndex: subCrit.orderIndex,
                createdAt: now,
                updatedAt: now,
              }))
            )
            .run();
        }
      }
    }

    return this.getById(scope, rubric.id);
  }

    update(scope: DataScope, id: number, data: {
      name?: string;
      description?: string;
      activityTypeId?: number | null;
      totalPoints?: number;
      isTemplate?: boolean;
      criteria?: Array<{ 
        name: string; 
        description?: string; 
        points: number; 
        orderIndex: number;
        subCriteria?: Array<{ name: string; description?: string; points: number; orderIndex: number }>;
      }>;
    }) {
    if (!this.getById(scope, id)) return undefined;
    const now = new Date();

    // Si se actualizan los criterios, validar
    if (data.criteria) {
      const totalCriteriaPoints = data.criteria.reduce((sum, crit) => sum + crit.points, 0);
      const totalPoints = data.totalPoints || this.getById(scope, id)?.totalPoints || 0;
      
      if (totalCriteriaPoints !== totalPoints) {
        throw new Error(
          `La suma de puntos de los criterios (${totalCriteriaPoints}) debe coincidir con el total de puntos (${totalPoints})`
        );
      }

      // Validar subcriterios
      for (const crit of data.criteria) {
        if (crit.subCriteria && crit.subCriteria.length > 0) {
          const totalSubCriteriaPoints = crit.subCriteria.reduce((sum, sub) => sum + sub.points, 0);
          if (totalSubCriteriaPoints !== crit.points) {
            throw new Error(
              `En el criterio "${crit.name}": La suma de puntos de los subcriterios (${totalSubCriteriaPoints}) debe coincidir con los puntos del criterio (${crit.points})`
            );
          }
        }
      }

      // Eliminar subcriterios y criterios existentes (CASCADE eliminará subcriterios automáticamente)
      this.db.delete(rubricCriteria).where(eq(rubricCriteria.rubricId, id)).run();

      // Crear nuevos criterios y subcriterios
      if (data.criteria.length > 0) {
        for (const crit of data.criteria) {
          const createdCriterion = this.db
            .insert(rubricCriteria)
            .values({
              rubricId: id,
              name: crit.name,
              description: crit.description,
              points: crit.points,
              orderIndex: crit.orderIndex,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .get();

          // Crear subcriterios si existen
          if (crit.subCriteria && crit.subCriteria.length > 0) {
            this.db
              .insert(rubricSubCriteria)
              .values(
                crit.subCriteria.map((subCrit) => ({
                  criterionId: createdCriterion.id,
                  name: subCrit.name,
                  description: subCrit.description,
                  points: subCrit.points,
                  orderIndex: subCrit.orderIndex,
                  createdAt: now,
                  updatedAt: now,
                }))
              )
              .run();
          }
        }
      }
    }

    // Actualizar la rúbrica
    return this.db
      .update(rubrics)
      .set({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.activityTypeId !== undefined && { activityTypeId: data.activityTypeId }),
        ...(data.totalPoints && { totalPoints: data.totalPoints }),
        ...(data.isTemplate !== undefined && { isTemplate: data.isTemplate }),
        updatedAt: now,
      })
      .where(eq(rubrics.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    if (!this.getById(scope, id)) return { changes: 0 };
    return this.db.delete(rubrics).where(eq(rubrics.id, id)).run();
  }
}

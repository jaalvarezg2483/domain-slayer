import { eq, and, ne } from 'drizzle-orm';
import {
  evaluations,
  gradeDistributionCategories,
  gradeDistributions,
  rubrics,
  rubricCriteria,
  rubricSubCriteria,
  courses,
} from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class EvaluationRepository {
  constructor(private db: Database) {}

  private assertCourseAccess(scope: DataScope, courseId: number): boolean {
    const c = this.db.select().from(courses).where(eq(courses.id, courseId)).get();
    if (!c) return false;
    return c.ownerUserId === scope.userId;
  }

  getByCourseId(scope: DataScope, courseId: number) {
    if (!this.assertCourseAccess(scope, courseId)) return [];
    const results = this.db
      .select({
        id: evaluations.id,
        courseId: evaluations.courseId,
        categoryId: evaluations.categoryId,
        activityTypeId: evaluations.activityTypeId,
        name: evaluations.name,
        percentage: evaluations.percentage,
        description: evaluations.description,
        rubricId: evaluations.rubricId,
        totalPoints: evaluations.totalPoints,
        periodNumber: evaluations.periodNumber,
        createdAt: evaluations.createdAt,
        updatedAt: evaluations.updatedAt,
        category: {
          id: gradeDistributionCategories.id,
          name: gradeDistributionCategories.name,
          percentage: gradeDistributionCategories.percentage,
        },
      })
      .from(evaluations)
      .innerJoin(gradeDistributionCategories, eq(evaluations.categoryId, gradeDistributionCategories.id))
      .where(eq(evaluations.courseId, courseId))
      .all();

    // Cargar rúbricas si existen (con criterios y subcriterios)
    return results.map((evalItem) => {
      if (evalItem.rubricId) {
        const rubric = this.db
          .select()
          .from(rubrics)
          .where(eq(rubrics.id, evalItem.rubricId))
          .get();
        
        if (rubric) {
          const criteria = this.db
            .select()
            .from(rubricCriteria)
            .where(eq(rubricCriteria.rubricId, rubric.id))
            .all()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map(criterion => {
              // Cargar subcriterios para cada criterio
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
            ...evalItem,
            rubric: {
              ...rubric,
              criteria,
            },
          };
        }
      }
      return evalItem;
    });
  }

  getByCategoryId(scope: DataScope, categoryId: number) {
    const cat = this.db
      .select()
      .from(gradeDistributionCategories)
      .where(eq(gradeDistributionCategories.id, categoryId))
      .get();
    if (!cat) return [];
    const dist = this.db
      .select()
      .from(gradeDistributions)
      .where(eq(gradeDistributions.id, cat.distributionId))
      .get();
    if (!dist) return [];
    if (dist.ownerUserId !== scope.userId) return [];
    return this.db
      .select()
      .from(evaluations)
      .where(eq(evaluations.categoryId, categoryId))
      .all();
  }

    create(scope: DataScope, data: {
      courseId: number;
      categoryId: number;
      activityTypeId?: number;
      name: string;
      percentage: number;
      description?: string;
      rubricId?: number;
      totalPoints?: number;
      periodNumber?: number;
    }) {
    if (!this.assertCourseAccess(scope, data.courseId)) {
      throw new Error('Curso no encontrado o sin permiso');
    }
    const now = new Date();

    // MOSTRAR DATOS QUE LLEGAN AL BACKEND
    console.log('🔵 BACKEND - Datos recibidos en create:', {
      courseId: data.courseId,
      categoryId: data.categoryId,
      name: data.name,
      percentage: data.percentage,
      periodNumber: data.periodNumber,
      activityTypeId: data.activityTypeId,
      rubricId: data.rubricId,
      totalPoints: data.totalPoints
    });

    // Obtener la categoría para validar
    const category = this.db
      .select()
      .from(gradeDistributionCategories)
      .where(eq(gradeDistributionCategories.id, data.categoryId))
      .get();

    if (!category) {
      throw new Error('Categoría no encontrada');
    }
    
    console.log('🔵 BACKEND - Categoría encontrada:', {
      id: category.id,
      name: category.name,
      percentage: category.percentage
    });

    // ⚠️ ESTE ES EL CÁLCULO QUE ESTABA CAUSANDO EL ERROR
    // Buscar TODAS las evaluaciones de esta categoría (SIN filtrar por período)
    const allCategoryEvaluations = this.db
      .select()
      .from(evaluations)
      .where(
        and(
          eq(evaluations.courseId, data.courseId),
          eq(evaluations.categoryId, data.categoryId)
          // ❌ PROBLEMA: NO FILTRA POR periodNumber - SUMA TODOS LOS SEMESTRES
        )
      )
      .all();
    
    // Calcular el total sumando TODAS las evaluaciones (de todos los semestres)
    const currentTotal = allCategoryEvaluations.reduce((sum, e) => sum + e.percentage, 0);
    const newTotal = currentTotal + data.percentage;
    
    console.log('🔴 BACKEND - CÁLCULO QUE CAUSA EL ERROR:', {
      todasEvaluaciones: allCategoryEvaluations.map(e => ({
        id: e.id,
        name: e.name,
        percentage: e.percentage,
        periodNumber: e.periodNumber
      })),
      currentTotal: currentTotal, // Este es el "Actual: 40%" del error
      nuevoPorcentaje: data.percentage,
      newTotal: newTotal, // Este es el "Nuevo total: 60%" del error
      categoryMax: category.percentage,
      excede: newTotal > category.percentage
    });
    
    // Validar porcentaje por período (semestre)
    if (data.periodNumber !== undefined && data.periodNumber !== null) {
      const periodEvaluations = this.db
        .select()
        .from(evaluations)
        .where(
          and(
            eq(evaluations.courseId, data.courseId),
            eq(evaluations.categoryId, data.categoryId),
            eq(evaluations.periodNumber, data.periodNumber) // ✅ FILTRA POR PERÍODO
          )
        )
        .all();
      
      const periodTotal = periodEvaluations.reduce((sum, e) => sum + e.percentage, 0);
      const periodNewTotal = periodTotal + data.percentage;
      
      console.log('🟢 BACKEND - Validación por período:', {
        periodNumber: data.periodNumber,
        evaluacionesDelPeriodo: periodEvaluations.map(e => ({
          id: e.id,
          name: e.name,
          percentage: e.percentage,
          periodNumber: e.periodNumber
        })),
        periodTotal: periodTotal,
        nuevoPorcentaje: data.percentage,
        periodNewTotal: periodNewTotal,
        categoryMax: category.percentage,
        excede: periodNewTotal > category.percentage
      });
      
      // Validar que no exceda el límite del período
      if (periodNewTotal > category.percentage) {
        throw new Error(
          `El porcentaje total de evaluaciones en esta categoría no puede exceder ${category.percentage}% por semestre. ` +
          `Actual en el semestre ${data.periodNumber}: ${periodTotal}%, Nuevo total: ${periodNewTotal}%`
        );
      }
    }

    // Si hay rúbrica, validar que totalPoints coincida con la rúbrica
    if (data.rubricId && data.totalPoints) {
      const rubric = this.db
        .select()
        .from(rubrics)
        .where(eq(rubrics.id, data.rubricId))
        .get();
      
      if (!rubric) {
        throw new Error('Rúbrica no encontrada');
      }

      if (data.totalPoints !== rubric.totalPoints) {
        throw new Error(
          `El total de puntos (${data.totalPoints}) debe coincidir con el total de puntos de la rúbrica (${rubric.totalPoints})`
        );
      }
    }

    return this.db
      .insert(evaluations)
      .values({
        courseId: data.courseId,
        categoryId: data.categoryId,
        activityTypeId: data.activityTypeId,
        name: data.name,
        percentage: data.percentage,
        description: data.description,
        rubricId: data.rubricId,
        totalPoints: data.totalPoints,
        periodNumber: data.periodNumber,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(scope: DataScope, id: number, data: Partial<{
    activityTypeId: number | null;
    name: string;
    percentage: number;
    description: string;
    rubricId: number | null;
    totalPoints: number | null;
    periodNumber?: number;
  }>) {
    const now = new Date();

    const evalRow = this.db.select().from(evaluations).where(eq(evaluations.id, id)).get();
    if (!evalRow || !this.assertCourseAccess(scope, evalRow.courseId)) {
      throw new Error('Evaluación no encontrada o sin permiso');
    }

    // Si se actualiza el porcentaje o el período, validar
    if (data.percentage !== undefined || data.periodNumber !== undefined) {
      const evaluation = evalRow;

      // Obtener la categoría
      const category = this.db
        .select()
        .from(gradeDistributionCategories)
        .where(eq(gradeDistributionCategories.id, evaluation.categoryId))
        .get();

      if (!category) {
        throw new Error('Categoría no encontrada');
      }

      // Usar el período actualizado o el existente
      const periodNumber = data.periodNumber !== undefined ? data.periodNumber : evaluation.periodNumber;
      const newPercentage = data.percentage !== undefined ? data.percentage : evaluation.percentage;

      // Si hay periodNumber, validar por período
      if (periodNumber !== undefined && periodNumber !== null) {
        // Obtener todas las evaluaciones del mismo período y categoría (excepto la actual)
        const otherEvaluations = this.db
          .select()
          .from(evaluations)
          .where(
            and(
              eq(evaluations.courseId, evaluation.courseId),
              eq(evaluations.categoryId, evaluation.categoryId),
              eq(evaluations.periodNumber, periodNumber),
              ne(evaluations.id, id) // Excluir la actual
            )
          )
          .all();

        const otherTotal = otherEvaluations.reduce((sum, e) => sum + e.percentage, 0);
        const newTotal = otherTotal + newPercentage;

        if (newTotal > category.percentage) {
          throw new Error(
            `El porcentaje total de evaluaciones en esta categoría no puede exceder ${category.percentage}% por semestre. ` +
            `Actual en el semestre ${periodNumber}: ${otherTotal}%, Nuevo total: ${newTotal}%`
          );
        }
      }
    }

    return this.db
      .update(evaluations)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(evaluations.id, id))
      .returning()
      .get();
  }

  delete(scope: DataScope, id: number) {
    const ev = this.db.select().from(evaluations).where(eq(evaluations.id, id)).get();
    if (!ev || !this.assertCourseAccess(scope, ev.courseId)) return { changes: 0 };
    return this.db.delete(evaluations).where(eq(evaluations.id, id)).run();
  }

  deleteByCourseId(scope: DataScope, courseId: number) {
    if (!this.assertCourseAccess(scope, courseId)) return { changes: 0 };
    return this.db.delete(evaluations).where(eq(evaluations.courseId, courseId)).run();
  }

  // Reutilizar evaluaciones de otro curso
  copyFromCourse(scope: DataScope, sourceCourseId: number, targetCourseId: number) {
    if (!this.assertCourseAccess(scope, sourceCourseId) || !this.assertCourseAccess(scope, targetCourseId)) {
      throw new Error('Uno o ambos cursos no existen o sin permiso');
    }
    const sourceEvaluations = this.db
      .select()
      .from(evaluations)
      .where(eq(evaluations.courseId, sourceCourseId))
      .all();

    const now = new Date();
    const copied = sourceEvaluations.map(evaluation =>
      this.db
        .insert(evaluations)
        .values({
          courseId: targetCourseId,
          categoryId: evaluation.categoryId,
          name: evaluation.name,
          percentage: evaluation.percentage,
          description: evaluation.description,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get()
    );

    return copied;
  }
}

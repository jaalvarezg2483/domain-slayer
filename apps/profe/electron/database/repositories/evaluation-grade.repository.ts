import { eq, and } from 'drizzle-orm';
import { evaluationGrades, evaluationGradeCriteria, students, rubricCriteria, evaluations, courses } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class EvaluationGradeRepository {
  constructor(private db: Database) {}

  private assertEvaluationAccess(scope: DataScope, evaluationId: number): boolean {
    const ev = this.db.select().from(evaluations).where(eq(evaluations.id, evaluationId)).get();
    if (!ev) return false;
    const c = this.db.select().from(courses).where(eq(courses.id, ev.courseId)).get();
    if (!c) return false;
    return c.ownerUserId === scope.userId;
  }

  // Obtener todas las calificaciones de una evaluación
  getByEvaluationId(scope: DataScope, evaluationId: number) {
    if (!this.assertEvaluationAccess(scope, evaluationId)) return [];
    const grades = this.db
      .select({
        id: evaluationGrades.id,
        evaluationId: evaluationGrades.evaluationId,
        studentId: evaluationGrades.studentId,
        score: evaluationGrades.score,
        totalScore: evaluationGrades.totalScore,
        notes: evaluationGrades.notes,
        createdAt: evaluationGrades.createdAt,
        updatedAt: evaluationGrades.updatedAt,
        student: {
          id: students.id,
          identifier: students.identifier,
          fullName: students.fullName,
          email: students.email,
          phone: students.phone,
        },
      })
      .from(evaluationGrades)
      .innerJoin(students, eq(evaluationGrades.studentId, students.id))
      .where(eq(evaluationGrades.evaluationId, evaluationId))
      .all();

    // Cargar criterios para cada calificación
    return grades.map((grade) => {
      const criteriaScores = this.db
        .select({
          id: evaluationGradeCriteria.id,
          criterionId: evaluationGradeCriteria.criterionId,
          score: evaluationGradeCriteria.score,
          maxScore: evaluationGradeCriteria.maxScore,
          criterion: {
            id: rubricCriteria.id,
            name: rubricCriteria.name,
            description: rubricCriteria.description,
            points: rubricCriteria.points,
            orderIndex: rubricCriteria.orderIndex,
          },
        })
        .from(evaluationGradeCriteria)
        .innerJoin(rubricCriteria, eq(evaluationGradeCriteria.criterionId, rubricCriteria.id))
        .where(eq(evaluationGradeCriteria.evaluationGradeId, grade.id))
        .all();

      return {
        ...grade,
        criteriaScores,
      };
    });
  }

  // Obtener calificación de un estudiante en una evaluación
  getByEvaluationAndStudent(scope: DataScope, evaluationId: number, studentId: number) {
    if (!this.assertEvaluationAccess(scope, evaluationId)) return null;
    const grade = this.db
      .select()
      .from(evaluationGrades)
      .where(and(eq(evaluationGrades.evaluationId, evaluationId), eq(evaluationGrades.studentId, studentId)))
      .get();

    if (!grade) return null;

    const criteriaScores = this.db
      .select({
        id: evaluationGradeCriteria.id,
        criterionId: evaluationGradeCriteria.criterionId,
        score: evaluationGradeCriteria.score,
        maxScore: evaluationGradeCriteria.maxScore,
        criterion: {
          id: rubricCriteria.id,
          name: rubricCriteria.name,
          description: rubricCriteria.description,
          points: rubricCriteria.points,
          orderIndex: rubricCriteria.orderIndex,
        },
      })
      .from(evaluationGradeCriteria)
      .innerJoin(rubricCriteria, eq(evaluationGradeCriteria.criterionId, rubricCriteria.id))
      .where(eq(evaluationGradeCriteria.evaluationGradeId, grade.id))
      .all();

    return {
      ...grade,
      criteriaScores,
    };
  }

  // Crear o actualizar calificación
  upsert(scope: DataScope, data: {
    evaluationId: number;
    studentId: number;
    score: number;
    totalScore: number;
    notes?: string;
    criteriaScores?: Array<{ criterionId: number; score: number; maxScore: number }>;
  }) {
    if (!this.assertEvaluationAccess(scope, data.evaluationId)) {
      throw new Error('Evaluación no encontrada o sin permiso');
    }
    const now = new Date();

    // Buscar si ya existe
    const existing = this.db
      .select()
      .from(evaluationGrades)
      .where(and(eq(evaluationGrades.evaluationId, data.evaluationId), eq(evaluationGrades.studentId, data.studentId)))
      .get();

    let gradeId: number;

    if (existing) {
      // Actualizar
      this.db
        .update(evaluationGrades)
        .set({
          score: data.score,
          totalScore: data.totalScore,
          notes: data.notes,
          updatedAt: now,
        })
        .where(eq(evaluationGrades.id, existing.id))
        .run();
      gradeId = existing.id;

      // Eliminar criterios existentes
      this.db.delete(evaluationGradeCriteria).where(eq(evaluationGradeCriteria.evaluationGradeId, gradeId)).run();
    } else {
      // Crear
      const newGrade = this.db
        .insert(evaluationGrades)
        .values({
          evaluationId: data.evaluationId,
          studentId: data.studentId,
          score: data.score,
          totalScore: data.totalScore,
          notes: data.notes,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
      gradeId = newGrade.id;
    }

    // Crear calificaciones por criterio si existen
    if (data.criteriaScores && data.criteriaScores.length > 0) {
      this.db
        .insert(evaluationGradeCriteria)
        .values(
          data.criteriaScores.map((cs) => ({
            evaluationGradeId: gradeId,
            criterionId: cs.criterionId,
            score: cs.score,
            maxScore: cs.maxScore,
            createdAt: now,
            updatedAt: now,
          }))
        )
        .run();
    }

    return this.getByEvaluationAndStudent(scope, data.evaluationId, data.studentId);
  }

  // Eliminar calificación
  delete(scope: DataScope, evaluationId: number, studentId: number) {
    if (!this.assertEvaluationAccess(scope, evaluationId)) return null;
    const grade = this.db
      .select()
      .from(evaluationGrades)
      .where(and(eq(evaluationGrades.evaluationId, evaluationId), eq(evaluationGrades.studentId, studentId)))
      .get();

    if (grade) {
      // Los criterios se eliminan automáticamente por CASCADE
      return this.db.delete(evaluationGrades).where(eq(evaluationGrades.id, grade.id)).run();
    }
    return null;
  }
}

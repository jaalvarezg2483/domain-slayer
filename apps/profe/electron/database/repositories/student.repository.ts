import { eq, like, or, and, inArray } from 'drizzle-orm';
import { students, studentCourses, courses } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

/** Normaliza cédula (sin guiones/espacios) para búsquedas consistentes. */
export function normalizeStudentIdentifier(raw: string): string {
  return raw.replace(/[\s-]/g, '').trim();
}

export class StudentRepository {
  constructor(private db: Database) {}

  /** IDs de estudiantes matriculados en al menos un curso de este docente. */
  private studentIdsForProfesorCourses(userId: number): number[] {
    const rows = this.db
      .select({ sid: studentCourses.studentId })
      .from(studentCourses)
      .innerJoin(courses, eq(courses.id, studentCourses.courseId))
      .where(eq(courses.ownerUserId, userId))
      .all();
    return [...new Set(rows.map((r) => r.sid))];
  }

  private canAccessStudentRow(scope: DataScope, studentId: number): boolean {
    return this.studentIdsForProfesorCourses(scope.userId).includes(studentId);
  }

  getAll(scope: DataScope) {
    const ids = this.studentIdsForProfesorCourses(scope.userId);
    if (ids.length === 0) return [];
    return this.db.select().from(students).where(inArray(students.id, ids)).all();
  }

  getById(scope: DataScope, id: number) {
    if (!this.canAccessStudentRow(scope, id)) return undefined;
    return this.db.select().from(students).where(eq(students.id, id)).get();
  }

  /** Existencia global (p. ej. al matricular en un curso propio). */
  getByIdRaw(id: number) {
    return this.db.select().from(students).where(eq(students.id, id)).get();
  }

  /** Búsqueda global por cédula (una persona = un registro); sirve para reutilizar al matricular. */
  getByIdentifier(_scope: DataScope, identifier: string) {
    const key = normalizeStudentIdentifier(identifier);
    if (!key) return undefined;
    return this.db.select().from(students).where(eq(students.identifier, key)).get();
  }

  search(scope: DataScope, query: string) {
    const searchTerm = `%${query.trim()}%`;
    const nameOrId = or(like(students.fullName, searchTerm), like(students.identifier, searchTerm));
    const ids = this.studentIdsForProfesorCourses(scope.userId);
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(students)
      .where(and(nameOrId, inArray(students.id, ids)))
      .all();
  }

  create(data: {
    identifier: string;
    fullName: string;
    email?: string;
    phone?: string;
    notes?: string;
  }) {
    const now = new Date();
    const identifier = normalizeStudentIdentifier(data.identifier);
    return this.db
      .insert(students)
      .values({
        ...data,
        identifier,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  update(scope: DataScope, id: number, data: Partial<typeof students.$inferInsert>) {
    if (!this.canAccessStudentRow(scope, id)) return undefined;
    const payload = { ...data };
    if (payload.identifier !== undefined) {
      payload.identifier = normalizeStudentIdentifier(payload.identifier);
    }
    return this.db
      .update(students)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(eq(students.id, id))
      .returning()
      .get();
  }

  /**
   * Borra la ficha global de persona (IPC debe comprobar rol admin).
   * El resto de usuarios quitan alumnos solo del curso (student_courses).
   */
  deleteGlobalStudent(id: number) {
    return this.db.delete(students).where(eq(students.id, id)).run();
  }
}

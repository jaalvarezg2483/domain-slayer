import { eq, and, inArray } from 'drizzle-orm';
import { studentCourses, students, courses } from '../schema.js';
import type { Database } from '../db.js';
import type { DataScope } from '../data-scope.js';

export class StudentCourseRepository {
  constructor(private db: Database) {}

  getByCourseId(scope: DataScope, courseId: number) {
    const ownerOk = and(eq(studentCourses.courseId, courseId), eq(courses.ownerUserId, scope.userId));
    return this.db
      .select({
        id: studentCourses.id,
        studentId: studentCourses.studentId,
        courseId: studentCourses.courseId,
        createdAt: studentCourses.createdAt,
        student: {
          id: students.id,
          identifier: students.identifier,
          fullName: students.fullName,
          email: students.email,
          phone: students.phone,
          notes: students.notes,
        },
      })
      .from(studentCourses)
      .innerJoin(students, eq(studentCourses.studentId, students.id))
      .innerJoin(courses, eq(studentCourses.courseId, courses.id))
      .where(ownerOk)
      .all();
  }

  getByStudentId(scope: DataScope, studentId: number) {
    const ownerOk = and(eq(studentCourses.studentId, studentId), eq(courses.ownerUserId, scope.userId));
    return this.db
      .select({
        id: studentCourses.id,
        studentId: studentCourses.studentId,
        courseId: studentCourses.courseId,
        createdAt: studentCourses.createdAt,
        course: {
          id: courses.id,
          name: courses.name,
          section: courses.section,
        },
      })
      .from(studentCourses)
      .innerJoin(courses, eq(studentCourses.courseId, courses.id))
      .where(ownerOk)
      .all();
  }

  getStudentsByCourseIds(scope: DataScope, courseIds: number[]) {
    if (courseIds.length === 0) return [];
    const ownerOk = and(inArray(studentCourses.courseId, courseIds), eq(courses.ownerUserId, scope.userId));
    return this.db
      .select({
        studentId: studentCourses.studentId,
        courseId: studentCourses.courseId,
        student: {
          id: students.id,
          identifier: students.identifier,
          fullName: students.fullName,
          email: students.email,
          phone: students.phone,
        },
      })
      .from(studentCourses)
      .innerJoin(students, eq(studentCourses.studentId, students.id))
      .innerJoin(courses, eq(studentCourses.courseId, courses.id))
      .where(ownerOk)
      .all();
  }

  create(data: { studentId: number; courseId: number }) {
    const now = new Date();
    return this.db
      .insert(studentCourses)
      .values({
        ...data,
        createdAt: now,
      })
      .returning()
      .get();
  }

  createMany(data: Array<{ studentId: number; courseId: number }>) {
    const now = new Date();
    return this.db
      .insert(studentCourses)
      .values(data.map((item) => ({ ...item, createdAt: now })))
      .returning()
      .all();
  }

  delete(scope: DataScope, id: number) {
    const row = this.db.select().from(studentCourses).where(eq(studentCourses.id, id)).get();
    if (!row) return { changes: 0 };
    const c = this.db.select().from(courses).where(eq(courses.id, row.courseId)).get();
    if (!c) return { changes: 0 };
    if (c.ownerUserId !== scope.userId) return { changes: 0 };
    return this.db.delete(studentCourses).where(eq(studentCourses.id, id)).run();
  }

  deleteByStudentAndCourse(scope: DataScope, studentId: number, courseId: number) {
    const c = this.db.select().from(courses).where(eq(courses.id, courseId)).get();
    if (!c) return { changes: 0 };
    if (c.ownerUserId !== scope.userId) return { changes: 0 };
    return this.db
      .delete(studentCourses)
      .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)))
      .run();
  }

  exists(scope: DataScope, studentId: number, courseId: number) {
    const c = this.db.select().from(courses).where(eq(courses.id, courseId)).get();
    if (!c) return undefined;
    if (c.ownerUserId !== scope.userId) return undefined;
    return this.db
      .select()
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)))
      .get();
  }
}

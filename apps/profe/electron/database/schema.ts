import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/** Roles de la aplicación: admin gestiona usuarios; profesor acceso estándar */
export type AppUserRole = 'admin' | 'profesor';

export const appUsers = sqliteTable('app_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().$default(() => 'profesor'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const schools = sqliteTable('schools', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  logoPath: text('logo_path'),
  reportHeader: text('report_header'),
  reportFooter: text('report_footer'),
  ownerUserId: integer('owner_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const periods = sqliteTable('periods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  year: text('year').notNull(), // Ej: "2026"
  type: text('type').notNull(), // 'trimestral' o 'semestral'
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
  ownerUserId: integer('owner_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** Vigencia: por período académico el usuario puede estar activo o inactivo. Sin fila = activo. */
export const appUserPeriodStatus = sqliteTable('app_user_period_status', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  periodId: integer('period_id')
    .notNull()
    .references(() => periods.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // 'active' | 'inactive'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Ej: "Desarrollo Web", "10-2", "Ingeniería en Sistemas"
  type: text('type'), // Opcional: "escuela", "colegio", "universidad", "tecnico" - para identificar el tipo
  level: text('level'), // Flexible: "1", "2", "3", "10", "11", "12", "Técnico", etc. (puede ser número o texto)
  section: text('section'), // Flexible: "1", "2", "3", "regular", "dual", "nocturno", etc. (puede ser número o texto)
  career: text('career'), // Opcional: Para universidades, ej: "Ingeniería en Sistemas", "Administración"
  schoolId: integer('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  ownerUserId: integer('owner_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Nombre del curso/materia (ej: "Matemáticas", "Programación")
  description: text('description'), // Descripción opcional
  section: text('section'), // Número de sección (opcional, ej: "3" para "1-3")
  groupId: integer('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  periodId: integer('period_id').notNull().references(() => periods.id, { onDelete: 'restrict' }),
  gradeDistributionId: integer('grade_distribution_id').references(() => gradeDistributions.id, { onDelete: 'set null' }),
  ownerUserId: integer('owner_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** Cédula/ID único a nivel nacional; la relación con cada docente es por matrícula (student_courses → courses). */
export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  identifier: text('identifier').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const studentCourses = sqliteTable('student_courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const gradeDistributions = sqliteTable('grade_distributions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Ej: "Regular", "Intensivo"
  description: text('description'),
  ownerUserId: integer('owner_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const gradeDistributionCategories = sqliteTable('grade_distribution_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  distributionId: integer('distribution_id').notNull().references(() => gradeDistributions.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Ej: "Exámenes", "Trabajo Cotidiano", "Portafolio"
  percentage: integer('percentage').notNull(), // Porcentaje como entero (ej: 40 para 40%)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const rubrics = sqliteTable('rubrics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Ej: "Rúbrica de Examen", "Rúbrica de Tarea"
  description: text('description'),
  activityTypeId: integer('activity_type_id').references(() => activityTypes.id, { onDelete: 'set null' }), // Tipo de actividad asociado (opcional, para filtrar)
  totalPoints: integer('total_points').notNull(), // Total de puntos de la rúbrica (ej: 30, 100)
  isTemplate: integer('is_template', { mode: 'boolean' }).notNull().$default(() => false), // Indica si es una plantilla reutilizable
  ownerUserId: integer('owner_user_id')
    .notNull()
    .references(() => appUsers.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const rubricCriteria = sqliteTable('rubric_criteria', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  rubricId: integer('rubric_id').notNull().references(() => rubrics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Ej: "Pareo", "Desarrollo", "Preguntas de opción múltiple", "Ejercicio 1"
  description: text('description'), // Descripción del criterio
  points: integer('points').notNull(), // Puntos que vale este criterio (ej: 10, 20)
  orderIndex: integer('order_index').notNull(), // Orden de visualización
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const rubricSubCriteria = sqliteTable('rubric_sub_criteria', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  criterionId: integer('criterion_id').notNull().references(() => rubricCriteria.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Ej: "Desarrollo", "Funcionamiento", "Presentación"
  description: text('description'), // Descripción del subcriterio
  points: integer('points').notNull(), // Puntos que vale este subcriterio
  orderIndex: integer('order_index').notNull(), // Orden de visualización dentro del criterio padre
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Tipos de Actividad - Define cómo se evalúa cada tipo
export const activityTypes = sqliteTable('activity_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // Ej: "Proyecto", "Tarea", "Examen", "Portafolio", "Trabajo Cotidiano"
  description: text('description'),
  evaluationModel: text('evaluation_model').notNull(), // 'RUBRICA_CRITERIOS', 'PUNTAJE_DIRECTO', 'PORTAFOLIO_ACUMULATIVO'
  maxScore: integer('max_score').notNull().$default(() => 100), // Puntaje máximo por defecto
  allowsRubric: integer('allows_rubric', { mode: 'boolean' }).notNull().$default(() => true), // Permite usar rúbrica
  allowsWeights: integer('allows_weights', { mode: 'boolean' }).notNull().$default(() => false), // Permite pesos
  allowsPenalties: integer('allows_penalties', { mode: 'boolean' }).notNull().$default(() => false), // Permite penalizaciones
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().$default(() => false), // Tipo predefinido del sistema
  active: integer('active', { mode: 'boolean' }).notNull().$default(() => true),
  /** null = tipos del sistema (visibles para todos los profesores) */
  ownerUserId: integer('owner_user_id').references(() => appUsers.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const evaluations = sqliteTable('evaluations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => gradeDistributionCategories.id, { onDelete: 'cascade' }),
  activityTypeId: integer('activity_type_id').references(() => activityTypes.id, { onDelete: 'set null' }), // Tipo de actividad
  name: text('name').notNull(), // Ej: "Examen 1", "Examen 2", "Tarea 1"
  percentage: integer('percentage').notNull(), // Porcentaje dentro de la categoría (ej: 20 para 20% del 40% de exámenes)
  description: text('description'),
  rubricId: integer('rubric_id').references(() => rubrics.id, { onDelete: 'set null' }), // Rúbrica asociada (opcional, solo si el tipo lo permite)
  totalPoints: integer('total_points'), // Total de puntos de la evaluación
  periodNumber: integer('period_number'), // Número del período: 1, 2 (semestral) o 1, 2, 3 (cuatrimestral/trimestral)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Calificaciones de estudiantes en evaluaciones
export const evaluationGrades = sqliteTable('evaluation_grades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),
  studentId: integer('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(), // Puntos obtenidos (total)
  totalScore: integer('total_score').notNull(), // Puntos totales de la evaluación
  notes: text('notes'), // Notas adicionales del profesor
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Calificaciones por criterio (cuando la evaluación tiene rúbrica)
export const evaluationGradeCriteria = sqliteTable('evaluation_grade_criteria', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationGradeId: integer('evaluation_grade_id').notNull().references(() => evaluationGrades.id, { onDelete: 'cascade' }),
  criterionId: integer('criterion_id').notNull().references(() => rubricCriteria.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(), // Puntos obtenidos en este criterio
  maxScore: integer('max_score').notNull(), // Puntos máximos de este criterio
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const schoolsRelations = relations(schools, ({ many }) => ({
  groups: many(groups),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  school: one(schools, {
    fields: [groups.schoolId],
    references: [schools.id],
  }),
  courses: many(courses),
}));

export const periodsRelations = relations(periods, ({ many }) => ({
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  group: one(groups, {
    fields: [courses.groupId],
    references: [groups.id],
  }),
  period: one(periods, {
    fields: [courses.periodId],
    references: [periods.id],
  }),
  studentCourses: many(studentCourses),
  evaluations: many(evaluations),
}));

export const gradeDistributionsRelations = relations(gradeDistributions, ({ many }) => ({
  categories: many(gradeDistributionCategories),
}));

export const gradeDistributionCategoriesRelations = relations(gradeDistributionCategories, ({ one, many }) => ({
  distribution: one(gradeDistributions, {
    fields: [gradeDistributionCategories.distributionId],
    references: [gradeDistributions.id],
  }),
  evaluations: many(evaluations),
}));

export const rubricsRelations = relations(rubrics, ({ one, many }) => ({
  activityType: one(activityTypes, {
    fields: [rubrics.activityTypeId],
    references: [activityTypes.id],
  }),
  criteria: many(rubricCriteria),
  evaluations: many(evaluations),
}));

export const rubricCriteriaRelations = relations(rubricCriteria, ({ one, many }) => ({
  rubric: one(rubrics, {
    fields: [rubricCriteria.rubricId],
    references: [rubrics.id],
  }),
  subCriteria: many(rubricSubCriteria),
}));

export const rubricSubCriteriaRelations = relations(rubricSubCriteria, ({ one }) => ({
  criterion: one(rubricCriteria, {
    fields: [rubricSubCriteria.criterionId],
    references: [rubricCriteria.id],
  }),
}));

export const activityTypesRelations = relations(activityTypes, ({ many }) => ({
  evaluations: many(evaluations),
}));

export const evaluationsRelations = relations(evaluations, ({ one, many }) => ({
  course: one(courses, {
    fields: [evaluations.courseId],
    references: [courses.id],
  }),
  category: one(gradeDistributionCategories, {
    fields: [evaluations.categoryId],
    references: [gradeDistributionCategories.id],
  }),
  activityType: one(activityTypes, {
    fields: [evaluations.activityTypeId],
    references: [activityTypes.id],
  }),
  rubric: one(rubrics, {
    fields: [evaluations.rubricId],
    references: [rubrics.id],
  }),
  grades: many(evaluationGrades),
}));

export const evaluationGradesRelations = relations(evaluationGrades, ({ one, many }) => ({
  evaluation: one(evaluations, {
    fields: [evaluationGrades.evaluationId],
    references: [evaluations.id],
  }),
  student: one(students, {
    fields: [evaluationGrades.studentId],
    references: [students.id],
  }),
  criteriaScores: many(evaluationGradeCriteria),
}));

export const evaluationGradeCriteriaRelations = relations(evaluationGradeCriteria, ({ one }) => ({
  evaluationGrade: one(evaluationGrades, {
    fields: [evaluationGradeCriteria.evaluationGradeId],
    references: [evaluationGrades.id],
  }),
  criterion: one(rubricCriteria, {
    fields: [evaluationGradeCriteria.criterionId],
    references: [rubricCriteria.id],
  }),
}));

export const studentsRelations = relations(students, ({ many }) => ({
  studentCourses: many(studentCourses),
  evaluationGrades: many(evaluationGrades),
}));

export const studentCoursesRelations = relations(studentCourses, ({ one }) => ({
  student: one(students, {
    fields: [studentCourses.studentId],
    references: [students.id],
  }),
  course: one(courses, {
    fields: [studentCourses.courseId],
    references: [courses.id],
  }),
}));

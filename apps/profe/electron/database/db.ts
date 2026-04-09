import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

let sqliteDb: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'gestor_academico.db');
}

export function initDatabase() {
  if (sqliteDb) {
    return db!;
  }

  const dbPath = getDatabasePath();
  
  // Si el archivo existe pero tiene problemas, intentar eliminarlo antes de abrir
  if (fs.existsSync(dbPath)) {
    try {
      // Intentar abrir para verificar si está corrupto
      const testDb = new Database(dbPath);
      testDb.close();
    } catch (error: any) {
      console.log('⚠️ Base de datos puede estar corrupta, se recreará...');
      try {
        fs.unlinkSync(dbPath);
        console.log('✅ Base de datos antigua eliminada');
      } catch (e) {
        console.log('⚠️ No se pudo eliminar, continuando...');
      }
    }
  }
  
  sqliteDb = new Database(dbPath);
  db = drizzle(sqliteDb, { schema });

  createTablesIfNotExist();

  return db;
}

export function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export type Database = ReturnType<typeof drizzle>;

export function closeDatabase() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    db = null;
  }
}

export function deleteDatabase() {
  try {
    // Cerrar conexión si está abierta
    closeDatabase();
    
    const dbPath = getDatabasePath();
    const dbDir = path.dirname(dbPath);
    
    console.log('🗑️ Eliminando base de datos...');
    console.log('   Ruta:', dbPath);
    
    // Eliminar archivo de base de datos
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✅ Archivo de base de datos eliminado:', dbPath);
    } else {
      console.log('⚠️ El archivo de base de datos no existe:', dbPath);
    }
    
    // También eliminar archivos relacionados (WAL, SHM)
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
      console.log('✅ Archivo WAL eliminado');
    }
    
    if (fs.existsSync(shmPath)) {
      fs.unlinkSync(shmPath);
      console.log('✅ Archivo SHM eliminado');
    }
    
    return { success: true, path: dbPath };
  } catch (error: any) {
    console.error('❌ Error eliminando base de datos:', error.message);
    return { success: false, error: error.message, path: getDatabasePath() };
  }
}

function createTablesIfNotExist() {
  if (!sqliteDb) {
    console.error('❌ sqliteDb no está inicializado');
    return;
  }
  
  console.log('🔧 Iniciando creación/migración de tablas...');

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      logo_path TEXT,
      report_header TEXT,
      report_footer TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Verificar si la tabla groups existe y tiene estructura antigua
  const groupsTableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='groups'").get() as any;
  
  if (groupsTableInfo) {
    const groupsColumns = sqliteDb.prepare("PRAGMA table_info(groups)").all() as any[];
    const hasAcademicYearId = groupsColumns.some((col: any) => col.name === 'academic_year_id');
    const hasType = groupsColumns.some((col: any) => col.name === 'type');
    const hasSection = groupsColumns.some((col: any) => col.name === 'section');
    const hasCareer = groupsColumns.some((col: any) => col.name === 'career');
    
    if (hasAcademicYearId || !hasType || !hasSection || !hasCareer) {
      // Migrar tabla groups
      try {
        sqliteDb.exec("CREATE TABLE groups_new (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT, level TEXT, section TEXT, career TEXT, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
        sqliteDb.exec("INSERT INTO groups_new (id, name, level, school_id, created_at, updated_at) SELECT id, name, level, school_id, created_at, updated_at FROM groups;");
        sqliteDb.exec("DROP TABLE groups;");
        sqliteDb.exec("ALTER TABLE groups_new RENAME TO groups;");
        console.log('Migración de tabla groups completada');
      } catch (error) {
        console.error('Error en migración de groups, recreando tabla:', error);
        sqliteDb.exec("DROP TABLE IF EXISTS groups;");
        sqliteDb.exec("CREATE TABLE groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT, level TEXT, section TEXT, career TEXT, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
      }
    } else {
      // Solo agregar columnas faltantes si no están
      if (!hasType) {
        try {
          sqliteDb.exec("ALTER TABLE groups ADD COLUMN type TEXT;");
          console.log('Columna type agregada a tabla groups');
        } catch (error) {
          console.error('Error agregando columna type:', error);
        }
      }
      if (!hasSection) {
        try {
          sqliteDb.exec("ALTER TABLE groups ADD COLUMN section TEXT;");
          console.log('Columna section agregada a tabla groups');
        } catch (error) {
          console.error('Error agregando columna section:', error);
        }
      }
      if (!hasCareer) {
        try {
          sqliteDb.exec("ALTER TABLE groups ADD COLUMN career TEXT;");
          console.log('Columna career agregada a tabla groups');
        } catch (error) {
          console.error('Error agregando columna career:', error);
        }
      }
    }
  } else {
    sqliteDb.exec("CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT, level TEXT, section TEXT, career TEXT, school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
  }

  // Verificar si la tabla courses existe y tiene estructura correcta
  const coursesTableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='courses'").get() as any;
  
  if (coursesTableInfo) {
    const coursesColumns = sqliteDb.prepare("PRAGMA table_info(courses)").all() as any[];
    const hasGroupId = coursesColumns.some((col: any) => col.name === 'group_id');
    const hasPeriodId = coursesColumns.some((col: any) => col.name === 'period_id');
    const hasSection = coursesColumns.some((col: any) => col.name === 'section');
    const hasGradeDistributionId = coursesColumns.some((col: any) => col.name === 'grade_distribution_id');
    
    // Si falta alguna columna esencial, recrear la tabla
    if (!hasGroupId || !hasPeriodId) {
      try {
        sqliteDb.exec("CREATE TABLE courses_new (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, section TEXT, group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, period_id INTEGER NOT NULL REFERENCES periods(id), grade_distribution_id INTEGER REFERENCES grade_distributions(id) ON DELETE SET NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
        sqliteDb.exec("INSERT INTO courses_new (id, name, description, created_at, updated_at) SELECT id, name, description, created_at, updated_at FROM courses WHERE EXISTS (SELECT 1 FROM courses);");
        sqliteDb.exec("DROP TABLE courses;");
        sqliteDb.exec("ALTER TABLE courses_new RENAME TO courses;");
        console.log('Migración de tabla courses completada');
      } catch (error) {
        console.error('Error en migración de courses, recreando tabla:', error);
        sqliteDb.exec("DROP TABLE IF EXISTS courses;");
        sqliteDb.exec("CREATE TABLE courses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, section TEXT, group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, period_id INTEGER NOT NULL REFERENCES periods(id), grade_distribution_id INTEGER REFERENCES grade_distributions(id) ON DELETE SET NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
      }
    } else {
      // Agregar columnas faltantes
      if (!hasSection) {
        try {
          sqliteDb.exec("ALTER TABLE courses ADD COLUMN section TEXT;");
          console.log('Columna section agregada a tabla courses');
        } catch (error) {
          console.error('Error agregando columna section:', error);
        }
      }
      if (!hasGradeDistributionId) {
        try {
          sqliteDb.exec("ALTER TABLE courses ADD COLUMN grade_distribution_id INTEGER REFERENCES grade_distributions(id) ON DELETE SET NULL;");
          console.log('Columna grade_distribution_id agregada a tabla courses');
        } catch (error) {
          console.error('Error agregando columna grade_distribution_id:', error);
        }
      }
    }
  } else {
    sqliteDb.exec("CREATE TABLE courses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, section TEXT, group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, period_id INTEGER NOT NULL REFERENCES periods(id), grade_distribution_id INTEGER REFERENCES grade_distributions(id) ON DELETE SET NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
  }

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

        CREATE TABLE IF NOT EXISTS student_courses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL
        );
      `);

  // Verificar y migrar tabla grade_distributions si es necesario
  const gradeDistributionsTableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='grade_distributions'").get() as any;
  
  if (gradeDistributionsTableInfo) {
    const gradeDistributionsColumns = sqliteDb.prepare("PRAGMA table_info(grade_distributions)").all() as any[];
    const hasCategoriesJson = gradeDistributionsColumns.some((col: any) => col.name === 'categories_json');
    const hasName = gradeDistributionsColumns.some((col: any) => col.name === 'name');
    const hasDescription = gradeDistributionsColumns.some((col: any) => col.name === 'description');
    
    // Si tiene categories_json o falta alguna columna esencial, recrear la tabla
    if (hasCategoriesJson || !hasName || !hasDescription) {
      try {
        sqliteDb.exec("CREATE TABLE grade_distributions_new (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
        // Intentar copiar datos existentes (solo id, name, description si existen)
        try {
          sqliteDb.exec("INSERT INTO grade_distributions_new (id, name, description, created_at, updated_at) SELECT id, name, description, created_at, updated_at FROM grade_distributions WHERE EXISTS (SELECT 1 FROM grade_distributions);");
        } catch (e) {
          console.log('No se pudieron copiar datos existentes de grade_distributions, continuando...');
        }
        sqliteDb.exec("DROP TABLE grade_distributions;");
        sqliteDb.exec("ALTER TABLE grade_distributions_new RENAME TO grade_distributions;");
        console.log('Migración de tabla grade_distributions completada');
      } catch (error) {
        console.error('Error en migración de grade_distributions, recreando tabla:', error);
        sqliteDb.exec("DROP TABLE IF EXISTS grade_distributions;");
        sqliteDb.exec("CREATE TABLE grade_distributions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);");
      }
    }
  } else {
    sqliteDb.exec(`
        CREATE TABLE grade_distributions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
  }

  // Crear tablas de categorías, rúbricas y evaluaciones
  sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS grade_distribution_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          distribution_id INTEGER NOT NULL REFERENCES grade_distributions(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          percentage INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rubrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          activity_type_id INTEGER,
          total_points INTEGER NOT NULL,
          is_template INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rubric_criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rubric_id INTEGER NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          points INTEGER NOT NULL,
          order_index INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rubric_sub_criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          points INTEGER NOT NULL,
          order_index INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          evaluation_model TEXT NOT NULL,
          max_score INTEGER NOT NULL DEFAULT 100,
          allows_rubric INTEGER NOT NULL DEFAULT 1,
          allows_weights INTEGER NOT NULL DEFAULT 0,
          allows_penalties INTEGER NOT NULL DEFAULT 0,
          is_default INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS evaluations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES grade_distribution_categories(id) ON DELETE CASCADE,
          activity_type_id INTEGER REFERENCES activity_types(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          percentage INTEGER NOT NULL,
          description TEXT,
          rubric_id INTEGER REFERENCES rubrics(id) ON DELETE SET NULL,
          total_points INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS evaluation_grades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          score INTEGER NOT NULL,
          total_score INTEGER NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(evaluation_id, student_id)
        );

        CREATE TABLE IF NOT EXISTS evaluation_grade_criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          evaluation_grade_id INTEGER NOT NULL REFERENCES evaluation_grades(id) ON DELETE CASCADE,
          criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          score INTEGER NOT NULL,
          max_score INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(evaluation_grade_id, criterion_id)
        );
      `);

  // Migración: Agregar activity_type_id a evaluations si no existe
  const evaluationsTableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='evaluations'").get() as any;
  if (evaluationsTableInfo) {
    const evaluationsColumns = sqliteDb.prepare("PRAGMA table_info(evaluations)").all() as any[];
    const hasActivityTypeId = evaluationsColumns.some((col: any) => col.name === 'activity_type_id');
    if (!hasActivityTypeId) {
      try {
        sqliteDb.exec("ALTER TABLE evaluations ADD COLUMN activity_type_id INTEGER REFERENCES activity_types(id) ON DELETE SET NULL;");
        console.log('✅ Migración: columna activity_type_id agregada a evaluations');
      } catch (error) {
        console.error('Error en migración de evaluations (activity_type_id), recreando tabla:', error);
        // Si falla, recrear la tabla
        try {
          sqliteDb.exec(`
            CREATE TABLE evaluations_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
              category_id INTEGER NOT NULL REFERENCES grade_distribution_categories(id) ON DELETE CASCADE,
              activity_type_id INTEGER REFERENCES activity_types(id) ON DELETE SET NULL,
              name TEXT NOT NULL,
              percentage INTEGER NOT NULL,
              description TEXT,
              rubric_id INTEGER REFERENCES rubrics(id) ON DELETE SET NULL,
              total_points INTEGER,
              period_number INTEGER,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
          `);
          // Copiar datos existentes
          try {
            sqliteDb.exec(`
              INSERT INTO evaluations_new (id, course_id, category_id, name, percentage, description, rubric_id, total_points, created_at, updated_at)
              SELECT id, course_id, category_id, name, percentage, description, rubric_id, total_points, created_at, updated_at
              FROM evaluations;
            `);
          } catch (e) {
            console.log('No se pudieron copiar datos existentes de evaluations');
          }
          sqliteDb.exec("DROP TABLE evaluations;");
          sqliteDb.exec("ALTER TABLE evaluations_new RENAME TO evaluations;");
          console.log('✅ Tabla evaluations recreada con activity_type_id');
        } catch (recreateError) {
          console.error('Error recreando tabla evaluations:', recreateError);
        }
      }
    }
    
    // Migración: Agregar period_number a evaluations si no existe
    const evaluationsColumnsAfter = sqliteDb.prepare("PRAGMA table_info(evaluations)").all() as any[];
    const hasPeriodNumber = evaluationsColumnsAfter.some((col: any) => col.name === 'period_number');
    if (!hasPeriodNumber) {
      try {
        sqliteDb.exec("ALTER TABLE evaluations ADD COLUMN period_number INTEGER;");
        console.log('✅ Migración: columna period_number agregada a evaluations');
      } catch (error) {
        console.error('Error agregando period_number a evaluations:', error);
      }
    }
  }

  // Migración CRÍTICA: Verificar y corregir estructura de rubrics
  // Si la tabla tiene problemas, la eliminamos y recreamos desde cero
  console.log('🔍 [RUBRICS MIGRATION] Iniciando verificación de tabla rubrics...');
  
  const rubricsTableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rubrics'").get() as any;
  
  if (rubricsTableInfo) {
    const rubricsColumns = sqliteDb.prepare("PRAGMA table_info(rubrics)").all() as any[];
    const columnNames = rubricsColumns.map((col: any) => col.name);
    const hasActivityTypeId = columnNames.includes('activity_type_id');
    const hasIsTemplate = columnNames.includes('is_template');
    
    console.log('📋 [RUBRICS MIGRATION] Columnas actuales:', columnNames.join(', '));
    console.log('   - activity_type_id:', hasActivityTypeId ? '✅' : '❌ FALTA');
    console.log('   - is_template:', hasIsTemplate ? '✅' : '❌ FALTA');
    
    // Si falta alguna columna crítica, eliminar y recrear la tabla
    if (!hasActivityTypeId || !hasIsTemplate) {
      console.log('🗑️ [RUBRICS MIGRATION] Eliminando tabla rubrics con estructura incorrecta...');
      
      try {
        // Deshabilitar foreign keys temporalmente
        sqliteDb.exec("PRAGMA foreign_keys = OFF;");
        
        // Eliminar tablas relacionadas primero (por foreign keys)
        sqliteDb.exec("DROP TABLE IF EXISTS rubric_sub_criteria;");
        sqliteDb.exec("DROP TABLE IF EXISTS rubric_criteria;");
        sqliteDb.exec("DROP TABLE IF EXISTS rubrics;");
        console.log('✅ Tabla rubrics y tablas relacionadas eliminadas');
        
        // Recrear con estructura correcta
        sqliteDb.exec(`
          CREATE TABLE rubrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            activity_type_id INTEGER,
            total_points INTEGER NOT NULL,
            is_template INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        console.log('✅ Tabla rubrics recreada con estructura correcta');
        
        // Recrear tablas relacionadas
        sqliteDb.exec(`
          CREATE TABLE rubric_criteria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rubric_id INTEGER NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            points INTEGER NOT NULL,
            order_index INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        
        sqliteDb.exec(`
          CREATE TABLE rubric_sub_criteria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            points INTEGER NOT NULL,
            order_index INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        
        // Rehabilitar foreign keys
        sqliteDb.exec("PRAGMA foreign_keys = ON;");
        
        console.log('✅✅✅ [RUBRICS MIGRATION] Tablas recreadas exitosamente');
      } catch (error: any) {
        console.error('❌❌❌ [RUBRICS MIGRATION] ERROR al recrear tablas:', error.message);
        // Asegurarse de reactivar foreign keys incluso si hay error
        try {
          sqliteDb.exec("PRAGMA foreign_keys = ON;");
        } catch (e) {}
        throw error;
      }
    } else {
      console.log('✅ [RUBRICS MIGRATION] Tabla rubrics ya tiene todas las columnas necesarias');
    }
  } else {
    console.log('ℹ️ [RUBRICS MIGRATION] Tabla rubrics no existe, se creará con estructura correcta');
    // La tabla se creó arriba con todas las columnas, no necesita migración
  }
  
  // Verificación final OBLIGATORIA
  try {
    const finalCheck = sqliteDb.prepare("PRAGMA table_info(rubrics)").all() as any[];
    const finalCols = finalCheck.map((col: any) => col.name);
    console.log('📋 [RUBRICS MIGRATION] VERIFICACIÓN FINAL - Columnas:', finalCols.join(', '));
    
    if (!finalCols.includes('activity_type_id') || !finalCols.includes('is_template')) {
      console.error('❌❌❌ [RUBRICS MIGRATION] ERROR CRÍTICO: Faltan columnas después de la migración');
      console.error('   Columnas encontradas:', finalCols);
      console.error('   Faltantes: activity_type_id=' + !finalCols.includes('activity_type_id') + ', is_template=' + !finalCols.includes('is_template'));
      // Forzar recreación como último recurso
      sqliteDb.exec("PRAGMA foreign_keys = OFF;");
      sqliteDb.exec("DROP TABLE IF EXISTS rubric_sub_criteria;");
      sqliteDb.exec("DROP TABLE IF EXISTS rubric_criteria;");
      sqliteDb.exec("DROP TABLE IF EXISTS rubrics;");
      sqliteDb.exec(`
        CREATE TABLE rubrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          activity_type_id INTEGER,
          total_points INTEGER NOT NULL,
          is_template INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      sqliteDb.exec(`
        CREATE TABLE rubric_criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rubric_id INTEGER NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          points INTEGER NOT NULL,
          order_index INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      sqliteDb.exec(`
        CREATE TABLE rubric_sub_criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          points INTEGER NOT NULL,
          order_index INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      sqliteDb.exec("PRAGMA foreign_keys = ON;");
      console.log('✅✅✅ [RUBRICS MIGRATION] Tablas recreadas forzadamente');
    } else {
      console.log('✅✅✅ [RUBRICS MIGRATION] Migración completada exitosamente');
    }
  } catch (e: any) {
    console.error('❌ Error en verificación final:', e.message);
    throw e;
  }

  // Migración: Crear tabla rubric_sub_criteria si no existe
  const subCriteriaTableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rubric_sub_criteria'").get() as any;
  if (!subCriteriaTableInfo) {
    try {
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS rubric_sub_criteria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          criterion_id INTEGER NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          points INTEGER NOT NULL,
          order_index INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
      console.log('✅ Migración: tabla rubric_sub_criteria creada');
    } catch (error) {
      console.error('Error creando tabla rubric_sub_criteria:', error);
    }
  }

  // Insertar tipos de actividad por defecto si no existen
  const activityTypesCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM activity_types").get() as any;
  if (activityTypesCount && activityTypesCount.count === 0) {
    const now = Date.now();
    sqliteDb.prepare(`
      INSERT INTO activity_types (name, description, evaluation_model, max_score, allows_rubric, allows_weights, allows_penalties, is_default, active, created_at, updated_at)
      VALUES
        ('Proyecto', 'Evaluación mediante proyecto que requiere rúbrica de criterios', 'RUBRICA_CRITERIOS', 100, 1, 0, 0, 1, 1, ?, ?),
        ('Tarea', 'Tarea evaluada mediante rúbrica de criterios', 'RUBRICA_CRITERIOS', 100, 1, 0, 0, 1, 1, ?, ?),
        ('Trabajo Cotidiano', 'Trabajo cotidiano evaluado mediante rúbrica', 'RUBRICA_CRITERIOS', 100, 1, 0, 0, 1, 1, ?, ?),
        ('Práctica', 'Práctica evaluada mediante rúbrica de criterios', 'RUBRICA_CRITERIOS', 100, 1, 0, 0, 1, 1, ?, ?),
        ('Examen', 'Examen con calificación por puntaje directo', 'PUNTAJE_DIRECTO', 100, 0, 0, 0, 1, 1, ?, ?),
        ('Portafolio', 'Portafolio acumulativo con evaluación progresiva', 'PORTAFOLIO_ACUMULATIVO', 100, 1, 0, 0, 1, 1, ?, ?)
    `).run(now, now, now, now, now, now, now, now, now, now, now, now);
    console.log('✅ Tipos de actividad por defecto creados');
  }

  // Verificar si la tabla periods existe
  const tableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='periods'").get() as any;
  
  if (tableInfo) {
    // Verificar si tiene la columna 'number' (estructura antigua)
    const columns = sqliteDb.prepare("PRAGMA table_info(periods)").all() as any[];
    const hasNumberColumn = columns.some((col: any) => col.name === 'number');
    const hasLabelColumn = columns.some((col: any) => col.name === 'label');
    
    if (hasNumberColumn || hasLabelColumn) {
      // Migrar: crear nueva tabla, copiar datos si existen, eliminar antigua
      try {
        sqliteDb.exec(`
          CREATE TABLE periods_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year TEXT NOT NULL,
            type TEXT NOT NULL,
            start_date INTEGER NOT NULL,
            end_date INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
        
        // Intentar copiar datos existentes (solo si tienen las columnas necesarias)
        try {
          sqliteDb.exec(`
            INSERT INTO periods_new (id, year, type, start_date, end_date, created_at, updated_at)
            SELECT id, year, type, start_date, end_date, created_at, updated_at
            FROM periods;
          `);
        } catch (e) {
          console.log('No se pudieron copiar datos existentes, continuando...');
        }
        
        sqliteDb.exec(`
          DROP TABLE periods;
          ALTER TABLE periods_new RENAME TO periods;
        `);
        
        console.log('Migración de tabla periods completada');
      } catch (error) {
        console.error('Error en migración, recreando tabla:', error);
        sqliteDb.exec(`DROP TABLE IF EXISTS periods;`);
        sqliteDb.exec(`
          CREATE TABLE periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year TEXT NOT NULL,
            type TEXT NOT NULL,
            start_date INTEGER NOT NULL,
            end_date INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );
        `);
      }
    }
  } else {
    // Crear tabla nueva
    sqliteDb.exec(`
      CREATE TABLE periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year TEXT NOT NULL,
        type TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'profesor',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
    CREATE TABLE IF NOT EXISTS app_user_period_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, period_id)
    );
    CREATE INDEX IF NOT EXISTS idx_app_user_period_status_user ON app_user_period_status(user_id);
  `);

  runDataOwnershipMigration(sqliteDb);
  runStudentsGlobalCedulaMigration(sqliteDb);
  runCanonicalProfesorOwnershipMigration(sqliteDb);
}

/**
 * Multi-tenant por profesor: cada fila académica tiene owner_user_id.
 * Datos existentes se asignan al primer usuario (típicamente el admin inicial).
 */
function runDataOwnershipMigration(sqliteDb: Database.Database) {
  const hasUsers = sqliteDb
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='app_users'`)
    .get() as { name: string } | undefined;
  if (!hasUsers) return;

  const first = sqliteDb.prepare('SELECT id FROM app_users ORDER BY id ASC LIMIT 1').get() as
    | { id: number }
    | undefined;
  const uid = first?.id;

  /* students: cédula única global; no owner_user_id en personas */
  const ownedTables = ['schools', 'periods', 'groups', 'courses', 'grade_distributions', 'rubrics'];
  for (const table of ownedTables) {
    const exists = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table) as
      | { name: string }
      | undefined;
    if (!exists) continue;
    const cols = sqliteDb.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (cols.some((c) => c.name === 'owner_user_id')) continue;
    try {
      sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN owner_user_id INTEGER REFERENCES app_users(id);`);
      console.log(`✅ Migración: owner_user_id en ${table}`);
    } catch (e) {
      console.error(`Migración owner_user_id (${table}):`, e);
    }
  }

  if (uid !== undefined) {
    for (const table of ownedTables) {
      try {
        sqliteDb.prepare(`UPDATE ${table} SET owner_user_id = ? WHERE owner_user_id IS NULL`).run(uid);
      } catch {
        /* tabla ausente */
      }
    }
  } else {
    console.log(
      '📌 Propietarios: aún no hay usuarios; columnas owner_user_id añadidas donde faltaban (sin reasignar filas existentes).',
    );
  }

  const atInfo = sqliteDb.prepare(`PRAGMA table_info(activity_types)`).all() as { name: string }[];
  if (atInfo.length && !atInfo.some((c) => c.name === 'owner_user_id')) {
    try {
      sqliteDb.exec(`ALTER TABLE activity_types ADD COLUMN owner_user_id INTEGER REFERENCES app_users(id);`);
      console.log('✅ Migración: owner_user_id en activity_types (nullable, tipos del sistema = NULL)');
    } catch (e) {
      console.error('Migración activity_types.owner_user_id:', e);
    }
  }

  const uvRow = sqliteDb.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  const uv = typeof uvRow?.user_version === 'number' ? uvRow.user_version : 0;
  if (uv >= 3) return;

  const stCols = sqliteDb.prepare(`PRAGMA table_info(students)`).all() as { name: string }[];
  if (!stCols.some((c) => c.name === 'owner_user_id')) {
    sqliteDb.exec('PRAGMA user_version = 3');
    return;
  }

  if (uid === undefined) {
    sqliteDb.exec('PRAGMA user_version = 3');
    return;
  }

  try {
    sqliteDb.prepare(`UPDATE students SET owner_user_id = ? WHERE owner_user_id IS NULL`).run(uid);
  } catch {
    sqliteDb.exec('PRAGMA user_version = 3');
    return;
  }

  try {
    sqliteDb.exec('PRAGMA foreign_keys=OFF;');
    sqliteDb.exec(`DROP TABLE IF EXISTS students_owner_rebuild;`);
    sqliteDb.exec(`
      CREATE TABLE students_owner_rebuild (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        notes TEXT,
        owner_user_id INTEGER NOT NULL REFERENCES app_users(id),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(owner_user_id, identifier)
      );
    `);
    sqliteDb.exec(`
      INSERT INTO students_owner_rebuild (id, identifier, full_name, email, phone, notes, owner_user_id, created_at, updated_at)
      SELECT id, identifier, full_name, email, phone, notes, owner_user_id, created_at, updated_at FROM students;
    `);
    sqliteDb.exec(`DROP TABLE students;`);
    sqliteDb.exec(`ALTER TABLE students_owner_rebuild RENAME TO students;`);
    sqliteDb.exec('PRAGMA foreign_keys=ON;');
    sqliteDb.exec('PRAGMA user_version = 3');
    console.log('✅ Estudiantes: restricción única por (profesor, cédula/ID)');
  } catch (e) {
    console.error('Migración students composite unique:', e);
    try {
      sqliteDb.exec('PRAGMA foreign_keys=ON;');
    } catch {
      /* ignore */
    }
    sqliteDb.exec('PRAGMA user_version = 3');
  }
}

/**
 * Cédula única en toda la app; el vínculo docente–alumno es por cursos (student_courses).
 * Fusiona filas duplicadas por misma cédula (migración anterior por docente) y elimina owner_user_id.
 */
function runStudentsGlobalCedulaMigration(sqliteDb: Database.Database) {
  const uvRow = sqliteDb.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  const uv = typeof uvRow?.user_version === 'number' ? uvRow.user_version : 0;
  if (uv >= 4) return;

  const stExists = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='students'`).get() as
    | { name: string }
    | undefined;
  if (!stExists) {
    sqliteDb.exec('PRAGMA user_version = 4');
    return;
  }

  const stCols = sqliteDb.prepare(`PRAGMA table_info(students)`).all() as { name: string }[];
  const hasOwner = stCols.some((c) => c.name === 'owner_user_id');

  if (!hasOwner) {
    sqliteDb.exec('PRAGMA user_version = 4');
    console.log('✅ Estudiantes: modelo cédula global (sin migración de fusión)');
    return;
  }

  try {
    sqliteDb.exec('PRAGMA foreign_keys=OFF;');

    const dupGroups = sqliteDb
      .prepare(
        `SELECT identifier, GROUP_CONCAT(id) AS ids FROM students GROUP BY identifier HAVING COUNT(*) > 1`,
      )
      .all() as { identifier: string; ids: string }[];

    for (const g of dupGroups) {
      const idList = g.ids
        .split(',')
        .map((x) => parseInt(x, 10))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
      if (idList.length < 2) continue;
      const keepId = idList[0];
      for (const oldId of idList.slice(1)) {
        sqliteDb
          .prepare(
            `DELETE FROM student_courses WHERE student_id = ? AND course_id IN (SELECT course_id FROM student_courses WHERE student_id = ?)`,
          )
          .run(oldId, keepId);
        sqliteDb.prepare(`UPDATE student_courses SET student_id = ? WHERE student_id = ?`).run(keepId, oldId);
        sqliteDb
          .prepare(
            `DELETE FROM evaluation_grades WHERE student_id = ? AND evaluation_id IN (SELECT evaluation_id FROM evaluation_grades WHERE student_id = ?)`,
          )
          .run(oldId, keepId);
        sqliteDb.prepare(`UPDATE evaluation_grades SET student_id = ? WHERE student_id = ?`).run(keepId, oldId);
        sqliteDb.prepare(`DELETE FROM students WHERE id = ?`).run(oldId);
      }
    }

    sqliteDb.exec(`DROP TABLE IF EXISTS students_global_cedula;`);
    sqliteDb.exec(`
      CREATE TABLE students_global_cedula (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    sqliteDb.exec(`
      INSERT INTO students_global_cedula (id, identifier, full_name, email, phone, notes, created_at, updated_at)
      SELECT id, identifier, full_name, email, phone, notes, created_at, updated_at FROM students;
    `);
    sqliteDb.exec(`DROP TABLE students;`);
    sqliteDb.exec(`ALTER TABLE students_global_cedula RENAME TO students;`);
    sqliteDb.exec('PRAGMA foreign_keys=ON;');
    sqliteDb.exec('PRAGMA user_version = 4');
    console.log('✅ Estudiantes: cédula única global; owner_user_id eliminado');
  } catch (e) {
    console.error('Migración students cédula global:', e);
    try {
      sqliteDb.exec('PRAGMA foreign_keys=ON;');
    } catch {
      /* ignore */
    }
    sqliteDb.exec('PRAGMA user_version = 4');
  }
}

/**
 * Una sola vez: reasigna todo lo académico existente al primer docente (menor id con role profesor).
 * Así los datos viejos (a menudo quedaron en el admin o mezclados) pertenecen a un único profesor;
 * el resto de docentes ve listas vacías hasta que creen sus propios registros.
 * Cada usuario (incl. admin) solo ve su propia data académica; el admin gestiona cuentas en Usuarios.
 */
function runCanonicalProfesorOwnershipMigration(sqliteDb: Database.Database) {
  const uvRow = sqliteDb.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  const uv = typeof uvRow?.user_version === 'number' ? uvRow.user_version : 0;
  if (uv >= 5) return;

  const usersTable = sqliteDb
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='app_users'`)
    .get() as { name: string } | undefined;
  if (!usersTable) {
    sqliteDb.exec('PRAGMA user_version = 5');
    return;
  }

  const prof = sqliteDb
    .prepare(`SELECT id FROM app_users WHERE lower(trim(role)) = 'profesor' ORDER BY id ASC LIMIT 1`)
    .get() as { id: number } | undefined;
  if (!prof) {
    console.log(
      '📌 Migración docente canónico: no hay ningún usuario con rol «profesor»; se reasignará al existir al menos uno (reinicia la app tras crearlo).',
    );
    return;
  }
  const targetId = prof.id;

  const ownedTables = ['schools', 'periods', 'groups', 'courses', 'grade_distributions', 'rubrics'];
  for (const table of ownedTables) {
    const exists = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table) as
      | { name: string }
      | undefined;
    if (!exists) continue;
    const cols = sqliteDb.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === 'owner_user_id')) continue;
    try {
      sqliteDb.prepare(`UPDATE ${table} SET owner_user_id = ?`).run(targetId);
    } catch (e) {
      console.error(`Migración propietario docente (${table}):`, e);
    }
  }

  try {
    const at = sqliteDb
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='activity_types'`)
      .get() as { name: string } | undefined;
    if (at) {
      const cols = sqliteDb.prepare(`PRAGMA table_info(activity_types)`).all() as { name: string }[];
      if (cols.some((c) => c.name === 'owner_user_id')) {
        sqliteDb
          .prepare(`UPDATE activity_types SET owner_user_id = ? WHERE owner_user_id IS NOT NULL`)
          .run(targetId);
      }
    }
  } catch (e) {
    console.error('Migración propietario docente (activity_types):', e);
  }

  sqliteDb.exec('PRAGMA user_version = 5');
  console.log(
    `✅ Datos académicos existentes reasignados al profesor con id=${targetId} (el de menor id). Los demás docentes empiezan limpios; cada cuenta ve solo lo suyo.`,
  );
}

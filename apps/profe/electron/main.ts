import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, closeDatabase, getDatabase, deleteDatabase, getDatabasePath } from './database/db.js';
import { SchoolRepository } from './database/repositories/school.repository.js';
import { PeriodRepository } from './database/repositories/period.repository.js';
import { GroupRepository } from './database/repositories/group.repository.js';
import { CourseRepository } from './database/repositories/course.repository.js';
import { StudentRepository } from './database/repositories/student.repository.js';
import { StudentCourseRepository } from './database/repositories/student-course.repository.js';
import { GradeDistributionRepository } from './database/repositories/grade-distribution.repository.js';
import { EvaluationRepository } from './database/repositories/evaluation.repository.js';
import { EvaluationGradeRepository } from './database/repositories/evaluation-grade.repository.js';
import { RubricRepository } from './database/repositories/rubric.repository.js';
import { ActivityTypeRepository } from './database/repositories/activity-type.repository.js';
import { AppUserRepository } from './database/repositories/app-user.repository.js';
import { AppUserPeriodStatusRepository } from './database/repositories/app-user-period-status.repository.js';
import { createAuthService } from './services/auth.service.js';
import { getSession, getPersonLookupConfig, setPersonLookupConfig } from './auth-store.js';
import { getDataScope } from './database/data-scope.js';
import { queryPersonByCedula } from './services/person-lookup.service.js';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta para guardar logos dentro del proyecto
const getLogosDirectory = () => {
  // En desarrollo: usar carpeta assets/logos en el proyecto
  // En producción: usar userData/assets/logos
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  if (isDev) {
    // En desarrollo, usar carpeta assets/logos relativa al proyecto
    const projectRoot = path.resolve(__dirname, '..');
    return path.join(projectRoot, 'assets', 'logos');
  } else {
    // En producción, usar userData para que persista
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'assets', 'logos');
  }
};

// Función para copiar logo a la carpeta del proyecto
const copyLogoToProject = async (sourcePath: string, schoolId?: number): Promise<string> => {
  try {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('El archivo de logo no existe');
    }

    const logosDir = getLogosDirectory();
    
    // Crear directorio si no existe
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }

    // Generar nombre único para el archivo
    const ext = path.extname(sourcePath).toLowerCase();
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(4).toString('hex');
    const filename = schoolId 
      ? `school_${schoolId}_${timestamp}_${randomHash}${ext}`
      : `school_${timestamp}_${randomHash}${ext}`;
    
    const destPath = path.join(logosDir, filename);
    
    // Copiar archivo
    fs.copyFileSync(sourcePath, destPath);
    
    console.log(`✅ Logo copiado a: ${destPath}`);
    
    // Retornar ruta relativa para guardar en BD
    // Guardamos la ruta completa para que funcione tanto en dev como en producción
    return destPath;
  } catch (error: any) {
    console.error('Error copiando logo:', error);
    throw error;
  }
};

// Función para eliminar logo antiguo
const deleteOldLogo = (logoPath: string) => {
  try {
    if (logoPath && fs.existsSync(logoPath)) {
      fs.unlinkSync(logoPath);
      console.log(`🗑️ Logo antiguo eliminado: ${logoPath}`);
    }
  } catch (error: any) {
    console.error('Error eliminando logo antiguo:', error);
    // No lanzar error, solo loguear
  }
};

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  
  if (!fs.existsSync(preloadPath)) {
    console.error(`ERROR: No se encontró el archivo preload en: ${preloadPath}`);
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  
  if (isDev) {
    const loadDevURL = () => {
      if (mainWindow) {
        mainWindow.loadURL('http://localhost:5173').catch((err) => {
          console.error('Error cargando URL, reintentando...', err.message);
          setTimeout(loadDevURL, 1000);
        });
      }
    };
    setTimeout(loadDevURL, 500);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  try {
    initDatabase();
    registerIpcHandlers();
    createWindow();
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpcHandlers() {
  const db = getDatabase();
  const schoolRepo = new SchoolRepository(db);
  const periodRepo = new PeriodRepository(db);
  const groupRepo = new GroupRepository(db);
  const courseRepo = new CourseRepository(db);
  const studentRepo = new StudentRepository(db);
  const studentCourseRepo = new StudentCourseRepository(db);
    const gradeDistributionRepo = new GradeDistributionRepository(db);
    const evaluationRepo = new EvaluationRepository(db);
    const rubricRepo = new RubricRepository(db);
    const evaluationGradeRepo = new EvaluationGradeRepository(db);
    const activityTypeRepo = new ActivityTypeRepository(db);
    const appUserRepo = new AppUserRepository(db);
    const appUserPeriodStatusRepo = new AppUserPeriodStatusRepository(db);
    const authService = createAuthService(appUserRepo, {
      periodRepo,
      periodStatusRepo: appUserPeriodStatusRepo,
    });

  ipcMain.handle('ping', () => 'pong');

  ipcMain.handle('auth:getBootstrap', () => authService.getBootstrap());
  ipcMain.handle('auth:register', async (_, data: { email: string; name: string; password: string }) =>
    authService.register(data),
  );
  ipcMain.handle('auth:login', async (_, data: { email: string; password: string }) => authService.login(data));
  ipcMain.handle('auth:logout', () => authService.logout());
  ipcMain.handle('auth:forgotPassword', async (_, email: string) => authService.forgotPassword(email));
  ipcMain.handle('auth:resetPassword', async (_, data: { token: string; newPassword: string }) =>
    authService.resetPassword(data),
  );
  ipcMain.handle('auth:listUsers', () => authService.listUsers());
  ipcMain.handle(
    'auth:createUser',
    async (_, data: { email: string; name: string; password: string; role: 'admin' | 'profesor' }) =>
      authService.createUser(data),
  );
  ipcMain.handle('auth:updateUserRole', async (_, userId: number, role: 'admin' | 'profesor') =>
    authService.updateUserRole(userId, role),
  );
  ipcMain.handle('auth:adminSetPassword', async (_, userId: number, newPassword: string) =>
    authService.adminSetPassword(userId, newPassword),
  );
  ipcMain.handle('auth:deleteUser', async (_, userId: number) => authService.deleteUser(userId));
  ipcMain.handle('auth:getMailSettings', () => authService.getMailSettings());
  ipcMain.handle('auth:setMailSettings', async (_, data: { url: string; secret: string }) =>
    authService.setMailSettings(data),
  );
  ipcMain.handle('auth:getUserPeriodVigencia', async (_, userId: number) =>
    authService.getUserPeriodVigencia(userId),
  );
  ipcMain.handle(
    'auth:setUserPeriodVigencia',
    async (_, userId: number, periodId: number, status: 'active' | 'inactive') =>
      authService.setUserPeriodVigencia(userId, periodId, status),
  );

  ipcMain.handle('personLookup:getSettings', () => {
    getDataScope();
    const c = getPersonLookupConfig();
    return { url: c.url, hasSecret: Boolean(c.secret) };
  });
  ipcMain.handle('personLookup:setSettings', (_, data: { url: string; secret: string }) => {
    const s = getSession();
    if (!s || s.role !== 'admin') {
      throw new Error('Solo un administrador puede configurar la consulta por cédula.');
    }
    setPersonLookupConfig(data.url, data.secret);
    return { ok: true as const };
  });
  ipcMain.handle('personLookup:query', async (_, cedula: string) => {
    getDataScope();
    return queryPersonByCedula(cedula);
  });

  ipcMain.handle('schools:getAll', async () => schoolRepo.getAll(getDataScope()));
  ipcMain.handle('schools:getById', async (_, id: number) => schoolRepo.getById(getDataScope(), id));
  ipcMain.handle('schools:create', async (_, data: any) => {
    const session = getSession()!;
    if (data.logoPath && fs.existsSync(data.logoPath)) {
      try {
        const newLogoPath = await copyLogoToProject(data.logoPath);
        data.logoPath = newLogoPath;
      } catch (error: any) {
        console.error('Error copiando logo al crear escuela:', error);
        throw new Error(`Error al guardar el logo: ${error.message}`);
      }
    }
    return schoolRepo.create({ ...data, ownerUserId: session.userId });
  });
  ipcMain.handle('schools:update', async (_, id: number, data: any) => {
    const scope = getDataScope();
    if (data.logoPath && fs.existsSync(data.logoPath)) {
      try {
        const currentSchool = schoolRepo.getById(scope, id);
        if (currentSchool && currentSchool.logoPath !== data.logoPath) {
          const newLogoPath = await copyLogoToProject(data.logoPath, id);
          if (currentSchool.logoPath) {
            deleteOldLogo(currentSchool.logoPath);
          }
          data.logoPath = newLogoPath;
        }
      } catch (error: any) {
        console.error('Error copiando logo al actualizar escuela:', error);
        throw new Error(`Error al guardar el logo: ${error.message}`);
      }
    }
    return schoolRepo.update(scope, id, data);
  });
  ipcMain.handle('schools:delete', async (_, id: number) => {
    const scope = getDataScope();
    const school = schoolRepo.getById(scope, id);
    if (school && school.logoPath) {
      deleteOldLogo(school.logoPath);
    }
    return schoolRepo.delete(scope, id);
  });

  ipcMain.handle('groups:getAll', async () => groupRepo.getAll(getDataScope()));
  ipcMain.handle('groups:getById', async (_, id: number) => groupRepo.getById(getDataScope(), id));
  ipcMain.handle('groups:getBySchoolId', async (_, schoolId: number) => groupRepo.getBySchoolId(getDataScope(), schoolId));
  ipcMain.handle('groups:create', async (_, data: any) => {
    const scope = getDataScope();
    const session = getSession()!;
    let ownerUserId = session.userId;
    if (data.schoolId != null) {
      const school = schoolRepo.getById(scope, data.schoolId);
      if (!school) throw new Error('Colegio no encontrado');
      ownerUserId = school.ownerUserId;
    }
    return groupRepo.create({ ...data, ownerUserId });
  });
  ipcMain.handle('groups:update', async (_, id: number, data: any) => groupRepo.update(getDataScope(), id, data));
  ipcMain.handle('groups:delete', async (_, id: number) => groupRepo.delete(getDataScope(), id));

  ipcMain.handle('courses:getAll', async () => courseRepo.getAll(getDataScope()));
  ipcMain.handle('courses:getById', async (_, id: number) => courseRepo.getById(getDataScope(), id));
  ipcMain.handle('courses:getByGroupId', async (_, groupId: number) => courseRepo.getByGroupId(getDataScope(), groupId));
  ipcMain.handle('courses:getByPeriodId', async (_, periodId: number) => courseRepo.getByPeriodId(getDataScope(), periodId));
  ipcMain.handle('courses:create', async (_, data: any) => {
    const scope = getDataScope();
    const group = groupRepo.getById(scope, data.groupId);
    if (!group) throw new Error('Grupo no encontrado');
    const period = periodRepo.getById(scope, data.periodId);
    if (!period) throw new Error('Período no encontrado');
    return courseRepo.create({ ...data, ownerUserId: group.ownerUserId });
  });
  ipcMain.handle('courses:update', async (_, id: number, data: any) => courseRepo.update(getDataScope(), id, data));
  ipcMain.handle('courses:delete', async (_, id: number) => courseRepo.delete(getDataScope(), id));

  ipcMain.handle('students:getAll', async () => studentRepo.getAll(getDataScope()));
  ipcMain.handle('students:getById', async (_, id: number) => studentRepo.getById(getDataScope(), id));
  ipcMain.handle('students:getByIdentifier', async (_, identifier: string) => {
    return studentRepo.getByIdentifier(getDataScope(), identifier);
  });
  ipcMain.handle('students:search', async (_, query: string) => studentRepo.search(getDataScope(), query));
  ipcMain.handle('students:create', async (_, data: any) => studentRepo.create(data));
  ipcMain.handle('students:update', async (_, id: number, data: any) => studentRepo.update(getDataScope(), id, data));
  ipcMain.handle('students:delete', async (_, id: number) => {
    const s = getSession();
    if (!s || s.role !== 'admin') {
      throw new Error('Solo un administrador puede eliminar la ficha global de un estudiante.');
    }
    return studentRepo.deleteGlobalStudent(id);
  });
  console.log('✅ Handlers de estudiantes registrados');

  ipcMain.handle('studentCourses:getByCourseId', async (_, courseId: number) =>
    studentCourseRepo.getByCourseId(getDataScope(), courseId),
  );
  ipcMain.handle('studentCourses:getByStudentId', async (_, studentId: number) =>
    studentCourseRepo.getByStudentId(getDataScope(), studentId),
  );
  ipcMain.handle('studentCourses:getStudentsByCourseIds', async (_, courseIds: number[]) =>
    studentCourseRepo.getStudentsByCourseIds(getDataScope(), courseIds),
  );
  ipcMain.handle('studentCourses:create', async (_, data: any) => {
    const scope = getDataScope();
    const cr = courseRepo.getById(scope, data.courseId);
    if (!cr) throw new Error('Curso no encontrado o sin permiso');
    const st = studentRepo.getByIdRaw(data.studentId);
    if (!st) throw new Error('Estudiante no encontrado');
    return studentCourseRepo.create(data);
  });
  ipcMain.handle('studentCourses:createMany', async (_, rows: any[]) => {
    const scope = getDataScope();
    for (const data of rows) {
      const cr = courseRepo.getById(scope, data.courseId);
      if (!cr) throw new Error('Curso no encontrado o sin permiso');
      if (!studentRepo.getByIdRaw(data.studentId)) throw new Error('Estudiante no encontrado');
    }
    return studentCourseRepo.createMany(rows);
  });
  ipcMain.handle('studentCourses:delete', async (_, id: number) => studentCourseRepo.delete(getDataScope(), id));
  ipcMain.handle('studentCourses:deleteByStudentAndCourse', async (_, studentId: number, courseId: number) =>
    studentCourseRepo.deleteByStudentAndCourse(getDataScope(), studentId, courseId),
  );
  ipcMain.handle('studentCourses:exists', async (_, studentId: number, courseId: number) =>
    studentCourseRepo.exists(getDataScope(), studentId, courseId),
  );

  ipcMain.handle('academicYears:getAll', async () => []);
  ipcMain.handle('academicYears:getById', async () => null);
  ipcMain.handle('academicYears:create', async () => {
    throw new Error('Años lectivos: pendiente de persistencia en la base local.');
  });
  ipcMain.handle('academicYears:update', async () => {
    throw new Error('Años lectivos: pendiente de persistencia en la base local.');
  });
  ipcMain.handle('academicYears:delete', async () => {
    throw new Error('Años lectivos: pendiente de persistencia en la base local.');
  });

  ipcMain.handle('periods:getAll', async () => periodRepo.getAll(getDataScope()));
  ipcMain.handle('periods:getById', async (_, id: number) => periodRepo.getById(getDataScope(), id));
  ipcMain.handle('periods:getByYear', async (_, year: string) => periodRepo.getByYear(getDataScope(), year));
  ipcMain.handle('periods:getByType', async (_, type: string) => periodRepo.getByType(getDataScope(), type as 'trimestral' | 'semestral'));
  ipcMain.handle('periods:getByTypeAndYear', async (_, type: string, year: string) =>
    periodRepo.getByTypeAndYear(getDataScope(), type as 'trimestral' | 'semestral', year),
  );
  ipcMain.handle('periods:getByAcademicYearId', async () => []);
  ipcMain.handle('periods:create', async (_, data: any) => {
    const session = getSession()!;
    return periodRepo.create({ ...data, ownerUserId: session.userId });
  });
  ipcMain.handle('periods:update', async (_, id: number, data: any) => periodRepo.update(getDataScope(), id, data));
  ipcMain.handle('periods:delete', async (_, id: number) => periodRepo.delete(getDataScope(), id));

  ipcMain.handle('gradeDistributions:getAll', async () => gradeDistributionRepo.getAll(getDataScope()));
  ipcMain.handle('gradeDistributions:getById', async (_, id: number) => gradeDistributionRepo.getById(getDataScope(), id));
  ipcMain.handle('gradeDistributions:getWithCategories', async (_, id: number) =>
    gradeDistributionRepo.getWithCategories(getDataScope(), id),
  );
  ipcMain.handle('gradeDistributions:create', async (_, data: any) => {
    const session = getSession()!;
    return gradeDistributionRepo.create({ ...data, ownerUserId: session.userId });
  });
  ipcMain.handle('gradeDistributions:update', async (_, id: number, data: any) =>
    gradeDistributionRepo.update(getDataScope(), id, data),
  );
  ipcMain.handle('gradeDistributions:delete', async (_, id: number) => gradeDistributionRepo.delete(getDataScope(), id));
  console.log('✅ Handlers de distribuciones de calificación registrados');

  ipcMain.handle('evaluations:getByCourseId', async (_, courseId: number) =>
    evaluationRepo.getByCourseId(getDataScope(), courseId),
  );
  ipcMain.handle('evaluations:getByCategoryId', async (_, categoryId: number) =>
    evaluationRepo.getByCategoryId(getDataScope(), categoryId),
  );
  ipcMain.handle('evaluations:create', async (_, data: any) => evaluationRepo.create(getDataScope(), data));
  ipcMain.handle('evaluations:update', async (_, id: number, data: any) => evaluationRepo.update(getDataScope(), id, data));
  ipcMain.handle('evaluations:delete', async (_, id: number) => evaluationRepo.delete(getDataScope(), id));
  ipcMain.handle('evaluations:deleteByCourseId', async (_, courseId: number) => {
    console.log('🗑️ Eliminando todas las evaluaciones del curso:', courseId);
    return evaluationRepo.deleteByCourseId(getDataScope(), courseId);
  });
  ipcMain.handle('evaluations:copyFromCourse', async (_, sourceCourseId: number, targetCourseId: number) =>
    evaluationRepo.copyFromCourse(getDataScope(), sourceCourseId, targetCourseId),
  );
  console.log('✅ Handlers de evaluaciones registrados');

  ipcMain.handle('evaluationGrades:getByEvaluationId', async (_, evaluationId: number) =>
    evaluationGradeRepo.getByEvaluationId(getDataScope(), evaluationId),
  );
  ipcMain.handle('evaluationGrades:getByEvaluationAndStudent', async (_, evaluationId: number, studentId: number) =>
    evaluationGradeRepo.getByEvaluationAndStudent(getDataScope(), evaluationId, studentId),
  );
  ipcMain.handle('evaluationGrades:upsert', async (_, data: any) => evaluationGradeRepo.upsert(getDataScope(), data));
  ipcMain.handle('evaluationGrades:delete', async (_, evaluationId: number, studentId: number) =>
    evaluationGradeRepo.delete(getDataScope(), evaluationId, studentId),
  );
  console.log('✅ Handlers de calificaciones registrados');

  ipcMain.handle('rubrics:getAll', async () => rubricRepo.getAll(getDataScope()));
  ipcMain.handle('rubrics:getById', async (_, id: number) => rubricRepo.getById(getDataScope(), id));
  ipcMain.handle('rubrics:getByActivityTypeId', async (_, activityTypeId: number) =>
    rubricRepo.getByActivityTypeId(getDataScope(), activityTypeId),
  );
  ipcMain.handle('rubrics:getTemplates', async () => rubricRepo.getTemplates(getDataScope()));
  ipcMain.handle('rubrics:create', async (_, data: any) => {
    const session = getSession()!;
    return rubricRepo.create(getDataScope(), { ...data, ownerUserId: session.userId });
  });
  ipcMain.handle('rubrics:update', async (_, id: number, data: any) => rubricRepo.update(getDataScope(), id, data));
  ipcMain.handle('rubrics:delete', async (_, id: number) => rubricRepo.delete(getDataScope(), id));
  console.log('✅ Handlers de rúbricas registrados');

  ipcMain.handle('activityTypes:getAll', async () => activityTypeRepo.getAll(getDataScope()));
  ipcMain.handle('activityTypes:getActive', async () => activityTypeRepo.getActive(getDataScope()));
  ipcMain.handle('activityTypes:getById', async (_, id: number) => activityTypeRepo.getById(getDataScope(), id));
  ipcMain.handle('activityTypes:getByEvaluationModel', async (_, model: string) =>
    activityTypeRepo.getByEvaluationModel(getDataScope(), model as any),
  );
  ipcMain.handle('activityTypes:create', async (_, data: any) => {
    const session = getSession()!;
    return activityTypeRepo.create({ ...data, ownerUserId: session.userId });
  });
  ipcMain.handle('activityTypes:update', async (_, id: number, data: any) =>
    activityTypeRepo.update(getDataScope(), id, data),
  );
  ipcMain.handle('activityTypes:delete', async (_, id: number) => activityTypeRepo.delete(getDataScope(), id));
  console.log('✅ Handlers de tipos de actividad registrados');

    ipcMain.handle('files:selectFile', async (_, options: any) => {
    const result = await dialog.showOpenDialog(mainWindow!, options);
    return result;
  });

    ipcMain.handle('files:readImageAsBase64', async (_, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const imageBuffer = fs.readFileSync(filePath);
      const base64 = imageBuffer.toString('base64');
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error leyendo imagen:', error);
      return null;
    }
  });

  // Handler para eliminar base de datos
  ipcMain.handle('database:delete', async () => {
    const result = deleteDatabase();
    if (result.success) {
      console.log('✅ Base de datos eliminada exitosamente');
      // Reinicializar después de eliminar
      initDatabase();
    }
    return result;
  });

  // Handler para obtener ruta de base de datos
  ipcMain.handle('database:getPath', async () => {
    return getDatabasePath();
  });
}

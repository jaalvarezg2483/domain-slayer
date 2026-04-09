export type AuthSessionUser = {
  userId: number;
  email: string;
  name: string;
  role: 'admin' | 'profesor';
};

export type AuthPublicUser = {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'profesor';
};

export type UserPeriodVigenciaRow = {
  periodId: number;
  year: string;
  type: string;
  startDate: number;
  endDate: number;
  status: 'active' | 'inactive';
};

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
      schools: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      groups: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        getBySchoolId: (schoolId: number) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      courses: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        getByGroupId: (groupId: number) => Promise<any[]>;
        getByPeriodId: (periodId: number) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      students: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        getByIdentifier: (identifier: string) => Promise<any>;
        search: (query: string) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      studentCourses: {
        getByCourseId: (courseId: number) => Promise<any[]>;
        getByStudentId: (studentId: number) => Promise<any[]>;
        getStudentsByCourseIds: (courseIds: number[]) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        createMany: (data: any[]) => Promise<any[]>;
        delete: (id: number) => Promise<any>;
        deleteByStudentAndCourse: (studentId: number, courseId: number) => Promise<any>;
        exists: (studentId: number, courseId: number) => Promise<any>;
      };
      academicYears: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      periods: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        getByYear: (year: string) => Promise<any[]>;
        getByType: (type: string) => Promise<any[]>;
        getByTypeAndYear: (type: string, year: string) => Promise<any[]>;
        getByAcademicYearId: (academicYearId: number) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      files: {
        selectFile: (options: any) => Promise<any>;
        readImageAsBase64: (filePath: string) => Promise<string | null>;
      };
      gradeDistributions: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        getWithCategories: (id: number) => Promise<any>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      evaluations: {
        getByCourseId: (courseId: number) => Promise<any[]>;
        getByCategoryId: (categoryId: number) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
        deleteByCourseId: (courseId: number) => Promise<any>;
        copyFromCourse: (sourceCourseId: number, targetCourseId: number) => Promise<any[]>;
      };
      rubrics: {
        getAll: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        getByActivityTypeId: (activityTypeId: number) => Promise<any[]>;
        getTemplates: () => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      evaluationGrades: {
        getByEvaluationId: (evaluationId: number) => Promise<any[]>;
        getByEvaluationAndStudent: (evaluationId: number, studentId: number) => Promise<any>;
        upsert: (data: any) => Promise<any>;
        delete: (evaluationId: number, studentId: number) => Promise<any>;
      };
      activityTypes: {
        getAll: () => Promise<any[]>;
        getActive: () => Promise<any[]>;
        getById: (id: number) => Promise<any>;
        getByEvaluationModel: (model: string) => Promise<any[]>;
        create: (data: any) => Promise<any>;
        update: (id: number, data: any) => Promise<any>;
        delete: (id: number) => Promise<any>;
      };
      auth: {
        getBootstrap: () => Promise<{ hasUsers: boolean; user: AuthSessionUser | null }>;
        register: (data: { email: string; name: string; password: string }) => Promise<{ user: AuthPublicUser }>;
        login: (data: { email: string; password: string }) => Promise<{ user: AuthPublicUser }>;
        logout: () => Promise<{ ok: boolean }>;
        forgotPassword: (
          email: string,
        ) => Promise<{ ok: boolean; emailSent: boolean; message?: string }>;
        resetPassword: (data: { token: string; newPassword: string }) => Promise<{ ok: boolean }>;
        listUsers: () => Promise<AuthPublicUser[]>;
        createUser: (data: {
          email: string;
          name: string;
          password: string;
          role: 'admin' | 'profesor';
        }) => Promise<AuthPublicUser>;
        updateUserRole: (userId: number, role: 'admin' | 'profesor') => Promise<AuthPublicUser>;
        adminSetPassword: (userId: number, newPassword: string) => Promise<{ ok: boolean }>;
        deleteUser: (userId: number) => Promise<{ ok: boolean }>;
        getMailSettings: () => Promise<{ url: string; hasSecret: boolean }>;
        setMailSettings: (data: { url: string; secret: string }) => Promise<{ ok: boolean }>;
        getUserPeriodVigencia: (userId: number) => Promise<UserPeriodVigenciaRow[]>;
        setUserPeriodVigencia: (
          userId: number,
          periodId: number,
          status: 'active' | 'inactive',
        ) => Promise<{ ok: boolean }>;
      };
      personLookup: {
        getSettings: () => Promise<{ url: string; hasSecret: boolean }>;
        setSettings: (data: { url: string; secret: string }) => Promise<{ ok: boolean }>;
        query: (
          cedula: string,
        ) => Promise<
          { ok: true; fullName?: string; raw?: unknown } | { ok: false; message: string }
        >;
      };
      database: {
        delete: () => Promise<{ success: boolean; path?: string; error?: string }>;
        getPath: () => Promise<string>;
      };
    };
  }
}

function getIpc() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.electronAPI || null;
}

export const ipc = new Proxy({} as typeof window.electronAPI, {
  get(_target, prop: string) {
    const api = getIpc();
    if (!api) {
      console.warn(`⚠️ electronAPI.${prop} no está disponible. Asegúrate de ejecutar en Electron.`);
      return () => Promise.reject(new Error(`electronAPI.${prop} no está disponible`));
    }
    const value = (api as any)[prop];
    if (typeof value === 'function') {
      return value.bind(api);
    }
    return value;
  }
});

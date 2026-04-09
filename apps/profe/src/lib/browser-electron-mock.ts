/**
 * Simula `window.electronAPI` cuando abres solo Vite en el navegador (npm run dev).
 * No hay SQLite ni IPC real: datos vacíos o de demostración solo para maquetar / revisar UI.
 */

import type { AuthSessionUser } from '@/lib/ipc';

declare global {
  interface Window {
    __GESTOR_BROWSER_PREVIEW__?: boolean;
    /** Sesión iniciada vía JWT compartido con Inventario DomainSlayer (`ds_jwt`). */
    __GESTOR_INVENTORY_BRIDGE__?: boolean;
  }
}

const DS_JWT_KEY = "ds_jwt";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const p = token.split(".")[1];
    if (!p) return null;
    return JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function subToUserId(sub: string): number {
  let h = 0;
  for (let i = 0; i < sub.length; i++) h = Math.imul(31, h) + sub.charCodeAt(i);
  return (Math.abs(h) >>> 0) || 1;
}

/**
 * Si el usuario ya inició sesión en Inventario y el JWT indica `homeApp: profe`,
 * reutiliza la sesión aquí (misma clave `ds_jwt` que el SPA principal).
 */
export function trySyncInventoryJwtSession(): void {
  if (typeof window === "undefined") return;
  if (!window.__GESTOR_BROWSER_PREVIEW__) return;
  let token: string | null = null;
  try {
    token = sessionStorage.getItem(DS_JWT_KEY);
  } catch {
    return;
  }
  if (!token) return;
  const payload = decodeJwtPayload(token);
  if (!payload?.email) return;
  const homeApp = payload.homeApp;
  if (homeApp === "inventory") return;
  if (homeApp !== "profe") return;

  const sub = typeof payload.sub === "string" ? payload.sub : "local";
  const nameRaw = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = String(payload.email).toLowerCase();
  const name = nameRaw || email.split("@")[0] || email;
  const roleRaw = payload.role === "viewer" ? ("profesor" as const) : ("admin" as const);

  const bridged: AuthSessionUser = {
    userId: subToUserId(sub),
    email,
    name,
    role: roleRaw,
  };
  mockSession = bridged;
  window.__GESTOR_INVENTORY_BRIDGE__ = true;
}

const mockSessionUser: AuthSessionUser = {
  userId: 1,
  email: 'vista-previa@local.dev',
  name: 'Vista previa (navegador)',
  role: 'admin',
};

/** null = pantalla de login; al hacer «login» se rellena (cualquier correo/clave en mock). */
let mockSession: AuthSessionUser | null = null;

function authPublic() {
  if (!mockSession) throw new Error('mockSession');
  return {
    id: mockSession.userId,
    email: mockSession.email,
    name: mockSession.name,
    role: mockSession.role,
  };
}

const emptyArr = () => Promise.resolve([] as any[]);
const voidOk = () => Promise.resolve({ ok: true });
const canceledFile = () => Promise.resolve({ canceled: true, filePaths: [] as string[] });

export function installBrowserElectronMock(): void {
  if (typeof window === 'undefined') return;
  window.__GESTOR_BROWSER_PREVIEW__ = true;

  window.electronAPI = {
    ping: () => Promise.resolve('pong (mock)'),
    auth: {
      getBootstrap: async () => ({
        hasUsers: true,
        user: mockSession,
      }),
      register: async () => {
        throw new Error('En el navegador no hay base de datos. Usa npm run electron:dev para registrar.');
      },
      login: async () => {
        mockSession = { ...mockSessionUser };
        return { user: authPublic() };
      },
      logout: async () => {
        mockSession = null;
        try {
          if (window.__GESTOR_INVENTORY_BRIDGE__) {
            sessionStorage.removeItem(DS_JWT_KEY);
            window.__GESTOR_INVENTORY_BRIDGE__ = false;
          }
        } catch {
          /* ignorar */
        }
        return { ok: true as const };
      },
      forgotPassword: async () => ({
        ok: true as const,
        emailSent: false,
        message: 'Solo disponible en la app de escritorio.',
      }),
      resetPassword: async () => {
        throw new Error('Solo en la app de escritorio.');
      },
      listUsers: emptyArr,
      createUser: async () => authPublic(),
      updateUserRole: async () => authPublic(),
      adminSetPassword: voidOk,
      deleteUser: voidOk,
      getMailSettings: async () => ({ url: '', hasSecret: false }),
      setMailSettings: voidOk,
      getUserPeriodVigencia: emptyArr,
      setUserPeriodVigencia: voidOk,
    },
    personLookup: {
      getSettings: async () => ({ url: '', hasSecret: false }),
      setSettings: voidOk,
      query: async () => ({
        ok: false as const,
        message: 'En el navegador no hay consulta por cédula. Usa la app de escritorio y configura un proxy en Usuarios.',
      }),
    },
    schools: {
      getAll: emptyArr,
      getById: async () => null,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    academicYears: {
      getAll: emptyArr,
      getById: async () => null,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    groups: {
      getAll: emptyArr,
      getById: async () => null,
      getBySchoolId: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    courses: {
      getAll: emptyArr,
      getById: async () => null,
      getByGroupId: emptyArr,
      getByPeriodId: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    students: {
      getAll: emptyArr,
      getById: async () => null,
      getByIdentifier: async () => null,
      search: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    studentCourses: {
      getByCourseId: emptyArr,
      getByStudentId: emptyArr,
      getStudentsByCourseIds: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      createMany: async (data: any[]) => data.map((d, i) => ({ id: Date.now() + i, ...d })),
      delete: async () => {},
      deleteByStudentAndCourse: async () => {},
      exists: async () => false,
    },
    periods: {
      getAll: emptyArr,
      getById: async () => null,
      getByYear: emptyArr,
      getByType: emptyArr,
      getByTypeAndYear: emptyArr,
      getByAcademicYearId: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    files: {
      selectFile: canceledFile,
      /** En navegador el logo se guarda como data URL en `logoPath`; no hay ruta en disco. */
      readImageAsBase64: async (filePath: string) => {
        if (filePath.startsWith("data:image/")) return filePath;
        return null;
      },
    },
    gradeDistributions: {
      getAll: emptyArr,
      getById: async () => null,
      getWithCategories: async () => null,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    evaluations: {
      getByCourseId: emptyArr,
      getByCategoryId: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
      deleteByCourseId: async () => {},
      copyFromCourse: emptyArr,
    },
    rubrics: {
      getAll: emptyArr,
      getById: async () => null,
      getByActivityTypeId: emptyArr,
      getTemplates: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    evaluationGrades: {
      getByEvaluationId: emptyArr,
      getByEvaluationAndStudent: async () => null,
      upsert: async (data: any) => data,
      delete: async () => {},
    },
    activityTypes: {
      getAll: emptyArr,
      getActive: emptyArr,
      getById: async () => null,
      getByEvaluationModel: emptyArr,
      create: async (data: any) => ({ id: Date.now(), ...data }),
      update: async (id: number, data: any) => ({ id, ...data }),
      delete: async () => {},
    },
    database: {
      delete: async () => ({ success: false, error: 'Solo en Electron' }),
      getPath: async () => '(mock navegador)',
    },
  } as unknown as Window['electronAPI'];

  console.info(
    "%c[Inventario Profe]%c Navegador: datos simulados. App de escritorio: npm run dev:electron",
    "font-weight:bold",
    ""
  );
}

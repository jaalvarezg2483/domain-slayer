/**
 * En `npm run dev`, Vite proxyea `/api` → backend.
 * En `vite build` + preview/Live Server/dist, `/api` relativo pega al servidor de estáticos (404).
 * Si abre la app desde localhost sin `VITE_API_BASE_URL`, usamos el backend en :3000 explícitamente.
 */
export type DocumentEmbeddedMediaItem = {
  fileName: string;
  contentType: string;
  relativePath: string;
};

export function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (fromEnv) {
    const base = fromEnv.replace(/\/$/, "");
    /** El backend monta el API en `/api` (main.ts). Si solo ponen el host (p. ej. http://srv:3000), añadimos /api. */
    if (/\/api$/i.test(base)) return base;
    return `${base}/api`;
  }
  if (import.meta.env.DEV) return "/api";
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") {
      return `http://${h}:3000/api`;
    }
  }
  return "/api";
}

export type MonitoringScheduleDto = {
  enabled: boolean;
  scheduleMode: "cron" | "interval";
  cronExpression: string;
  intervalDays: number;
  runHour: number;
  runMinute: number;
  cronAlternateWeeks: boolean;
  /** 0 | 1 cuando bisemanal (paridad semana ISO); null si no aplica */
  isoWeekParity: number | null;
  /** Mensual «primer día de la semana»: cron semanal + solo días 1–7 del mes */
  cronFirstWeekOnly: boolean;
  notifyEmails: string;
  teamsWebhookUrl: string | null;
  notifyEmailEnabled: boolean;
  notifyTeamsEnabled: boolean;
  notifyOn: "always" | "alerts_only";
  lastScheduledRunAt: string | null;
  /** Chequeo diario independiente: solo sitios en ventana de proximidad del panel (≤10 días). */
  proximityDailyEnabled: boolean;
  /** Hora local del servidor (0–23). */
  proximityRunHour: number;
  lastProximityDailyRunAt: string | null;
  updatedAt: string;
  /** Solo lectura (API): el servidor tiene SMTP_HOST; si es false, en producción faltan variables de entorno. */
  smtpConfigured?: boolean;
};

const BACKEND_HINT =
  "Arranque el backend (raíz del repo: npm run dev:backend o npm run start:backend). Debe escuchar en el puerto 3000 " +
  "o defina VITE_API_BASE_URL con la URL correcta del API.";

export const AUTH_STORAGE_KEY = "ds_jwt";

export function setAuthToken(token: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  if (token) sessionStorage.setItem(AUTH_STORAGE_KEY, token);
  else sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

export function hasAuthToken(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return Boolean(sessionStorage.getItem(AUTH_STORAGE_KEY));
}

export function authHeaders(): Record<string, string> {
  if (typeof sessionStorage === "undefined") return {};
  const t = sessionStorage.getItem(AUTH_STORAGE_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function parseContentDispositionFileName(cd: string | null): string | null {
  if (!cd) return null;
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(cd);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"+|"+$/g, ""));
    } catch {
      /* continuar */
    }
  }
  const quoted = /filename="((?:\\.|[^"\\])*)"/i.exec(cd);
  if (quoted) return quoted[1].replace(/\\"/g, '"');
  const plain = /filename=([^;]+)/i.exec(cd);
  if (plain) return plain[1].trim().replace(/^["']|["']$/g, "");
  return null;
}

function redirectLoginIfUnauthorized(): void {
  if (typeof window === "undefined") return;
  setAuthToken(null);
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
      throw new Error(`Sin conexión al API (${apiBase()}). ${BACKEND_HINT}`);
    }
    throw e;
  }
  if (res.status === 401) {
    /* POST /auth/login devuelve 401 con { error } si el correo/clave no coinciden; no es «sesión expirada». */
    const loginAttempt = /\/auth\/login$/i.test(path);
    if (loginAttempt) {
      const err = await res.json().catch(() => ({} as { error?: string }));
      const msg = (err as { error?: string }).error?.trim();
      throw new Error(msg || "Credenciales incorrectas.");
    }
    redirectLoginIfUnauthorized();
    throw new Error("Sesión no válida o expirada. Vuelva a iniciar sesión.");
  }
  if (!res.ok) {
    if (res.status === 503) {
      const j = await res.json().catch(() => null as { unavailable?: string; error?: string } | null);
      const msg = j?.unavailable?.trim() || j?.error?.trim();
      throw new Error(msg || `Servicio no disponible (503). ${BACKEND_HINT}`);
    }
    if (res.status === 502 || res.status === 504) {
      throw new Error(`El API no respondió (${res.status}). ${BACKEND_HINT}`);
    }
    const err = await res.json().catch(() => ({ error: res.statusText }) as { error?: string; errors?: string[] });
    const fromErrors =
      Array.isArray((err as { errors?: string[] }).errors) && (err as { errors: string[] }).errors.length > 0
        ? (err as { errors: string[] }).errors.join(" · ")
        : "";
    const fallback =
      res.status === 500 && (res.statusText === "Internal Server Error" || !res.statusText)
        ? `Error del servidor (${res.status}). ${BACKEND_HINT}`
        : res.statusText;
    throw new Error((err as { error?: string }).error?.trim() || fromErrors || fallback);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  sites: {
    list: (q?: Record<string, string | number | boolean | undefined>) =>
      request<{ items: unknown[]; total: number }>(`/sites${toQuery(q)}`),
    get: (id: string) => request<unknown>(`/sites/${id}`),
    create: (body: unknown) => request<unknown>(`/sites`, { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      request<unknown>(`/sites/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/sites/${id}`, { method: "DELETE" }),
    history: (siteId: string, q?: { limit?: number; offset?: number }) =>
      request<{ items: unknown[]; total: number }>(`/sites/${siteId}/history${toQuery(q)}`),
    documents: (siteId: string) => request<unknown[]>(`/sites/${siteId}/documents`),
    /** Enlaza un documento de la biblioteca al sitio (el mismo documento puede enlazarse a varios sitios). */
    addDocumentLink: (siteId: string, documentId: string) =>
      request<{ ok: boolean; alreadyLinked?: boolean }>(`/sites/${siteId}/document-links`, {
        method: "POST",
        body: JSON.stringify({ documentId }),
      }),
    removeDocumentLink: (siteId: string, documentId: string) =>
      request<void>(`/sites/${siteId}/document-links/${documentId}`, { method: "DELETE" }),
  },
  documents: {
    list: (q?: { limit?: number; offset?: number }) =>
      request<{
        items: Array<{
          id: string;
          siteId: string | null;
          siteName: string | null;
          documentType: string;
          title: string;
          description: string | null;
          fileName: string | null;
          fileSizeBytes: number | null;
          mimeType: string | null;
          createdAt: string;
        }>;
        total: number;
      }>(`/documents${toQuery(q)}`),
    remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
    create: (body: unknown) => request<unknown>(`/documents`, { method: "POST", body: JSON.stringify(body) }),
    /** multipart/form-data: file, siteId, title, documentType, description (opcional) */
    upload: async (form: FormData) => {
      const res = await fetch(`${apiBase()}/documents/upload`, {
        method: "POST",
        body: form,
        headers: authHeaders(),
      });
      if (res.status === 401) {
        redirectLoginIfUnauthorized();
        throw new Error("Sesión no válida o expirada.");
      }
      if (!res.ok) {
        const parsed = await res.json().catch(() => null as { error?: string } | null);
        const fromJson = parsed?.error?.trim();
        if (fromJson) throw new Error(fromJson);
        if (res.status === 404) {
          throw new Error(
            "404 en POST …/documents/upload: confirme que el proceso del backend está en marcha " +
              "(raíz del repo: `npm run start:backend`) y escucha en el puerto 3000. " +
              "Si el API usa otro puerto, defina VITE_API_BASE_URL (p. ej. http://localhost:PUERTO/api) y vuelva a compilar el frontend."
          );
        }
        throw new Error(res.statusText || `Error HTTP ${res.status}`);
      }
      return res.json() as Promise<Record<string, unknown> & { extractionNote?: string }>;
    },
    /** Descarga el archivo original (PDF, Office, etc.) con la sesión actual. */
    downloadFile: async (id: string, fallbackFileName: string) => {
      let res: Response;
      try {
        res = await fetch(`${apiBase()}/documents/${encodeURIComponent(id)}/download`, {
          headers: authHeaders(),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
          throw new Error(`Sin conexión al API (${apiBase()}). ${BACKEND_HINT}`);
        }
        throw e;
      }
      if (res.status === 401) {
        redirectLoginIfUnauthorized();
        throw new Error("Sesión no válida o expirada. Vuelva a iniciar sesión.");
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }) as { error?: string });
        throw new Error(err.error?.trim() || `No se pudo descargar (${res.status}).`);
      }
      const name = parseContentDispositionFileName(res.headers.get("Content-Disposition")) || fallbackFileName;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    search: (
      q: string,
      opts?: { limit?: number; offset?: number; match?: "all" | "any"; ai?: boolean }
    ) =>
      request<{
        items: unknown[];
        total: number;
        aiAnswer?: string;
        aiError?: string;
        aiUnavailable?: string;
        aiLocal?: boolean;
      }>(
        `/documents/search${toQuery({
          q,
          limit: opts?.limit,
          offset: opts?.offset,
          match: opts?.match,
          ai: opts?.ai ? "1" : undefined,
        })}`
      ),
  },
  alerts: {
    list: (q?: Record<string, string | number | boolean | undefined>) =>
      request<{ items: unknown[]; total: number }>(`/alerts${toQuery(q)}`),
    read: (id: string) => request<{ ok: boolean }>(`/alerts/${id}/read`, { method: "POST" }),
    resolve: (id: string) => request<{ ok: boolean }>(`/alerts/${id}/resolve`, { method: "POST" }),
    resolveAllOpen: () => request<{ count: number }>(`/alerts/resolve-all`, { method: "POST" }),
  },
  monitoring: {
    checkOne: (siteId: string) => request<unknown>(`/monitoring/check/${siteId}`, { method: "POST" }),
    checkAll: () => request<unknown>(`/monitoring/check-all`, { method: "POST" }),
  },
  monitoringSchedule: {
    get: () => request<MonitoringScheduleDto>(`/settings/monitoring-schedule`),
    update: (body: Partial<MonitoringScheduleDto>) =>
      request<MonitoringScheduleDto>(`/settings/monitoring-schedule`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    testNotify: (body: {
      notifyEmails: string;
      teamsWebhookUrl: string | null;
      testEmail: boolean;
      testTeams: boolean;
    }) =>
      request<{ emailSent: boolean; teamsSent: boolean; errors: string[] }>(
        `/settings/monitoring-schedule/test-notify`,
        { method: "POST", body: JSON.stringify(body) }
      ),
  },
  dashboard: {
    summary: () => request<{ sites: { items: unknown[] }; alerts: { items: unknown[] } }>(`/dashboard/summary`),
  },
  users: {
    list: () => request<{ items: { id: string; email: string; createdAt: string }[] }>(`/users`),
    create: (body: { email: string; password: string }) =>
      request<{ ok: boolean; email: string }>(`/users`, { method: "POST", body: JSON.stringify(body) }),
    updatePassword: (id: string, password: string) =>
      request<{ ok: boolean }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify({ password }) }),
    remove: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
  },
  libraryAssistant: {
    ask: (question: string) =>
      request<{
        answer: string;
        answerMode?: "local" | "ollama";
        sources: { documentCount: number; siteCount: number; totalDocumentsMatching: number };
        documentRefs?: { id: string; title: string; embeddedMedia: DocumentEmbeddedMediaItem[] | null }[];
        unavailable?: string;
        error?: string;
      }>(`/library/assistant`, { method: "POST", body: JSON.stringify({ question }) }),
  },
  auth: {
    status: () => request<{ authRequired: boolean }>(`/auth/status`),
    login: (email: string, password: string) =>
      request<{ token?: string; authDisabled?: boolean; message?: string; user?: { email: string } }>(
        `/auth/login`,
        { method: "POST", body: JSON.stringify({ email, password }) }
      ),
  },
};

function toQuery(q?: Record<string, string | number | boolean | undefined>) {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

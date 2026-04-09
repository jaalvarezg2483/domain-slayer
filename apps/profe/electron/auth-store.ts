import Store from 'electron-store';

export type SessionUser = {
  userId: number;
  email: string;
  name: string;
  role: 'admin' | 'profesor';
};

type AuthStoreSchema = {
  session: SessionUser | null;
  mailServiceUrl: string;
  mailApiSecret: string;
  /** URL base de un proxy tuyo (p. ej. TSE/Registro); GET …/cedula devuelve JSON. */
  personLookupUrl: string;
  personLookupSecret: string;
};

const store = new Store<AuthStoreSchema>({
  name: 'gestor-auth',
  defaults: {
    session: null,
    mailServiceUrl: '',
    mailApiSecret: '',
    personLookupUrl: '',
    personLookupSecret: '',
  },
});

function normalizeSession(session: SessionUser): SessionUser | null {
  const userId = Number(session.userId);
  if (!Number.isFinite(userId)) return null;
  const r = String(session.role ?? '').toLowerCase().trim();
  const role: 'admin' | 'profesor' = r === 'admin' ? 'admin' : 'profesor';
  return {
    userId,
    email: String(session.email ?? '').trim(),
    name: String(session.name ?? '').trim(),
    role,
  };
}

export function getSession(): SessionUser | null {
  const raw = store.get('session');
  if (!raw) return null;
  return normalizeSession(raw);
}

export function setSession(session: SessionUser | null): void {
  if (!session) {
    store.set('session', null);
    return;
  }
  const normalized = normalizeSession(session);
  store.set('session', normalized);
}

export function getMailConfig(): { url: string; secret: string } {
  return {
    url: store.get('mailServiceUrl').trim().replace(/\/$/, ''),
    secret: store.get('mailApiSecret').trim(),
  };
}

export function setMailConfig(url: string, secret: string): void {
  store.set('mailServiceUrl', url.trim());
  if (secret.trim() !== '') {
    store.set('mailApiSecret', secret.trim());
  }
}

export function getPersonLookupConfig(): { url: string; secret: string } {
  return {
    url: store.get('personLookupUrl').trim().replace(/\/$/, ''),
    secret: store.get('personLookupSecret').trim(),
  };
}

export function setPersonLookupConfig(url: string, secret: string): void {
  store.set('personLookupUrl', url.trim());
  if (secret.trim() !== '') {
    store.set('personLookupSecret', secret.trim());
  }
}

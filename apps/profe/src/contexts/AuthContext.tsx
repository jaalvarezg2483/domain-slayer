import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthSessionUser } from '@/lib/ipc';

type AuthState = {
  loading: boolean;
  hasUsers: boolean;
  user: AuthSessionUser | null;
};

type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthApi() {
  return typeof window !== 'undefined' ? window.electronAPI?.auth : undefined;
}

const AUTH_WAIT_MS = 50;
const AUTH_WAIT_MAX_TRIES = 30;
const BOOTSTRAP_RETRIES = 4;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    hasUsers: false,
    user: null,
  });

  const refresh = useCallback(async () => {
    let auth = getAuthApi();
    let tries = 0;
    while (!auth && tries < AUTH_WAIT_MAX_TRIES) {
      await new Promise((r) => setTimeout(r, AUTH_WAIT_MS));
      auth = getAuthApi();
      tries += 1;
    }

    if (!auth) {
      console.warn('[auth] electronAPI.auth no disponible tras esperar; se muestra login.');
      setState({ loading: false, hasUsers: true, user: null });
      return;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < BOOTSTRAP_RETRIES; attempt += 1) {
      try {
        const b = await auth.getBootstrap();
        setState({
          loading: false,
          hasUsers: b.hasUsers,
          user: b.user,
        });
        return;
      } catch (e) {
        lastError = e;
        if (attempt < BOOTSTRAP_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
        }
      }
    }

    console.error('[auth] getBootstrap falló tras reintentos:', lastError);
    setState({ loading: false, hasUsers: true, user: null });
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      console.error('[auth] refresh inesperado:', e);
      setState({ loading: false, hasUsers: true, user: null });
    });
  }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

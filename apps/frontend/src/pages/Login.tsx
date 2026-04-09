import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, hasAuthToken, setAuthToken } from "../api";
import { readAuthPayload, setSessionDisplayName } from "../lib/auth-session";
import { profeAppEntryUrl, sessionUsesProfeApp } from "../lib/profe-app-route";
import { AppBrand } from "../components/AppBrand";
import { ThemeToggle } from "../components/ThemeToggle";

function safeInternalPath(next: string | null): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.includes("..")) return null;
  if (next.startsWith("/profe")) return null;
  return next;
}

export function Login() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancel = false;
    api.auth
      .status()
      .then((s) => {
        if (cancel) return;
        if (!s.authRequired) {
          nav("/", { replace: true });
          return;
        }
        if (hasAuthToken()) {
          const p = readAuthPayload();
          if (p?.email && sessionUsesProfeApp(p.email, p.homeApp)) {
            window.location.replace(profeAppEntryUrl());
          } else {
            nav("/", { replace: true });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setChecking(false);
      });
    return () => {
      cancel = true;
    };
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await api.auth.login(email, password);
      if (r.authDisabled) {
        try {
          sessionStorage.setItem("ds_snail_welcome", "1");
        } catch {
          /* ignorar */
        }
        nav("/", { replace: true });
        return;
      }
      if (r.token) {
        setAuthToken(r.token);
        setSessionDisplayName(r.user?.displayName?.trim() || null);
        try {
          sessionStorage.setItem("ds_snail_welcome", "1");
        } catch {
          /* ignorar */
        }
        const loggedEmail = (r.user?.email ?? email).trim().toLowerCase();
        const homeApp = r.user?.homeApp;
        if (sessionUsesProfeApp(loggedEmail, homeApp)) {
          window.location.replace(profeAppEntryUrl());
          return;
        }
        const next = safeInternalPath(searchParams.get("next"));
        nav(next ?? "/", { replace: true });
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (checking) {
    return (
      <div className="login-standalone login-standalone--loading muted">
        <div className="login-standalone__theme-bar">
          <ThemeToggle />
        </div>
        Cargando…
      </div>
    );
  }

  return (
    <div className="login-standalone">
      <div className="login-standalone__theme-bar">
        <ThemeToggle />
      </div>
      <div className="login-standalone__inner">
        <header className="login-standalone__brand">
          <AppBrand variant="standalone" />
        </header>
        <div className="card login-card">
          <h1 className="login-card__title">Iniciar sesión</h1>
          <form onSubmit={(e) => void submit(e)} className="stack login-form">
            <label className="modal-notes-label">
              <span className="modal-notes-label-text">Correo</span>
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="modal-notes-label">
              <span className="modal-notes-label-text">Contraseña</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {err ? <div className="card error">{err}</div> : null}
            <button type="submit" className="btn login-submit">
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, hasAuthToken, setAuthToken } from "../api";
import { AppBrand } from "../components/AppBrand";

export function Login() {
  const nav = useNavigate();
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
          nav("/", { replace: true });
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
        nav("/", { replace: true });
        return;
      }
      if (r.token) {
        setAuthToken(r.token);
        nav("/", { replace: true });
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (checking) {
    return (
      <div className="login-standalone login-standalone--loading muted">
        Cargando…
      </div>
    );
  }

  return (
    <div className="login-standalone">
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

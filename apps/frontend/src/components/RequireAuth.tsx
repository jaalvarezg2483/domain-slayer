import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, apiBase, hasAuthToken } from "../api";
import { AuthModeContext } from "../auth-context";

type GateState = "loading" | "allowed" | "login" | "error";

/**
 * Si el backend tiene JWT_SECRET, todas las rutas bajo Layout exigen sesión;
 * sin token válido se redirige a /login.
 * Si no se puede contactar /auth/status, no se asume acceso (antes se abría la app por error).
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [authRequired, setAuthRequired] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    api.auth
      .status()
      .then((s) => {
        if (cancel) return;
        setErrorDetail(null);
        setAuthRequired(Boolean(s.authRequired));
        if (s.authRequired && !hasAuthToken()) setState("login");
        else setState("allowed");
      })
      .catch((e: unknown) => {
        if (!cancel) {
          setErrorDetail(e instanceof Error ? e.message : String(e));
          setState("error");
        }
      });
    return () => {
      cancel = true;
    };
  }, [retryKey]);

  if (state === "loading") {
    return (
      <div className="login-standalone muted" style={{ padding: "2rem" }}>
        Cargando…
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="login-standalone" style={{ padding: "1.5rem" }}>
        <div className="card error" style={{ maxWidth: "26rem", margin: "0 auto" }}>
          <p style={{ margin: "0 0 0.5rem" }}>
            No se pudo verificar la sesión con el servidor (sin respuesta o error de red).
          </p>
          <p className="muted small" style={{ margin: "0 0 0.35rem" }}>
            Compruebe que el servicio de la aplicación está en marcha y que esta página usa la dirección correcta.
          </p>
          <p className="muted small" style={{ margin: "0 0 0.5rem", wordBreak: "break-all" }}>
            Dirección del servicio: <code className="small">{apiBase()}</code>
          </p>
          {errorDetail ? (
            <p
              className="small"
              style={{
                margin: "0 0 0.75rem",
                padding: "0.5rem 0.55rem",
                borderRadius: 8,
                background: "rgba(0,0,0,0.25)",
                fontFamily: "ui-monospace, monospace",
                whiteSpace: "pre-wrap",
              }}
            >
              {errorDetail}
            </p>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => {
              setState("loading");
              setRetryKey((k) => k + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (state === "login") {
    return <Navigate to="/login" replace />;
  }
  return <AuthModeContext.Provider value={{ authRequired }}>{children}</AuthModeContext.Provider>;
}

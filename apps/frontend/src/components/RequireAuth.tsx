import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, hasAuthToken } from "../api";

type GateState = "loading" | "allowed" | "login";

/**
 * Si el backend tiene JWT_SECRET, todas las rutas bajo Layout exigen sesión;
 * sin token válido se redirige a /login.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    let cancel = false;
    api.auth
      .status()
      .then((s) => {
        if (cancel) return;
        if (s.authRequired && !hasAuthToken()) setState("login");
        else setState("allowed");
      })
      .catch(() => {
        if (!cancel) setState("allowed");
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="login-standalone muted" style={{ padding: "2rem" }}>
        Cargando…
      </div>
    );
  }
  if (state === "login") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

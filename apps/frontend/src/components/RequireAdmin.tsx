import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthMode } from "../auth-context";
import { readAuthPayload } from "../lib/auth-session";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { authRequired } = useAuthMode();
  if (!authRequired) {
    return <>{children}</>;
  }
  const p = readAuthPayload();
  if (!p) {
    return <Navigate to="/login" replace />;
  }
  if (p.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

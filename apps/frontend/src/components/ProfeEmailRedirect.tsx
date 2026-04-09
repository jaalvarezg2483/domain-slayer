import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { hasAuthToken } from "../api";
import { readAuthPayload } from "../lib/auth-session";
import { profeAppEntryUrl, sessionUsesProfeApp } from "../lib/profe-app-route";

/**
 * Si la sesión es de un usuario «profe», no debe quedarse en el inventario en la raíz: va a la otra SPA.
 */
export function ProfeEmailRedirect() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!hasAuthToken()) return;
    const p = readAuthPayload();
    if (!p?.email) return;
    if (!sessionUsesProfeApp(p.email, p.homeApp)) return;
    if (pathname !== "/" && pathname !== "") return;
    window.location.replace(profeAppEntryUrl());
  }, [pathname]);

  return null;
}

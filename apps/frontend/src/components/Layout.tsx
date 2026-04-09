import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  getSessionDisplayName,
  readAuthPayload,
  setSessionDisplayName,
  sidebarUserLabel,
} from "../lib/auth-session";
import { hasAuthToken, setAuthToken } from "../api";
import { useAuthMode } from "../auth-context";
import { AppBrand } from "./AppBrand";
import { ProfeEmailRedirect } from "./ProfeEmailRedirect";
import { SessionTransitionOverlay } from "./SessionTransitionOverlay";
import { ThemeToggle } from "./ThemeToggle";
import {
  IconAlerts,
  IconAssistant,
  IconClock,
  IconDashboard,
  IconLibrary,
  IconPlusSite,
  IconReports,
  IconSites,
  IconUsers,
} from "./NavIcons";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link active" : "nav-link";
}

function navClassNew({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--new active" : "nav-link nav-link--new";
}

function IconMenuHamburger() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function IconMenuClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function Layout() {
  const nav = useNavigate();
  const location = useLocation();
  const { authRequired } = useAuthMode();
  const [showLogout, setShowLogout] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [sessionSnail, setSessionSnail] = useState<"welcome" | "goodbye" | null>(null);
  const [displayNameRev, setDisplayNameRev] = useState(0);

  useEffect(() => {
    setShowLogout(hasAuthToken());
  }, []);

  useEffect(() => {
    const onDisplayName = () => setDisplayNameRev((n) => n + 1);
    window.addEventListener("ds-display-name", onDisplayName);
    return () => window.removeEventListener("ds-display-name", onDisplayName);
  }, []);

  /** Si hay JWT con nombre pero aún no hay caché (p. ej. recarga), alinear caché para el menú. */
  useEffect(() => {
    const p = readAuthPayload();
    if (!p?.name.trim()) return;
    if (!getSessionDisplayName()) {
      setSessionDisplayName(p.name.trim());
    }
  }, [location.pathname, showLogout, displayNameRev]);

  /**
   * Bienvenida tras login: sin `return () => clearTimeout` para que React Strict Mode no cancele el cierre y deje el overlay colgado.
   */
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ds_snail_welcome") !== "1") return;
      sessionStorage.removeItem("ds_snail_welcome");
      setSessionSnail("welcome");
      window.setTimeout(() => {
        setSessionSnail((prev) => (prev === "welcome" ? null : prev));
      }, 1750);
    } catch {
      /* sessionStorage no disponible */
    }
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!navOpen) return;
    const mq = window.matchMedia("(max-width: 900px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const close = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", close);
    close();
    return () => mq.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const closeNav = () => setNavOpen(false);

  const session = useMemo(() => readAuthPayload(), [location.pathname, showLogout, displayNameRev]);
  const isAdmin = !authRequired || session?.role === "admin";

  return (
    <div className={`layout-root${navOpen ? " layout-root--nav-open" : ""}`}>
      {sessionSnail ? <SessionTransitionOverlay open mode={sessionSnail} /> : null}
      <header className="layout-mobile-bar">
        <button
          type="button"
          className="layout-nav-toggle btn ghost"
          aria-expanded={navOpen}
          aria-controls="app-sidebar-nav"
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? <IconMenuClose /> : <IconMenuHamburger />}
          <span className="layout-nav-toggle__label">{navOpen ? "Cerrar" : "Menú"}</span>
        </button>
        <ThemeToggle compact className="layout-mobile-bar__theme" />
        <span className="layout-mobile-bar__title">Inventario Sitios Web</span>
      </header>

      <button
        type="button"
        className="layout-nav-backdrop"
        aria-label="Cerrar menú de navegación"
        tabIndex={navOpen ? 0 : -1}
        onClick={closeNav}
      />

      <div className="layout">
      <aside id="app-sidebar-nav" className="sidebar">
        <div className="sidebar__top">
          <AppBrand variant="sidebar" />
          <div className="sidebar__theme-desktop-only">
            <ThemeToggle compact />
          </div>
        </div>
        {showLogout && session ? (
          <p className="sidebar__welcome">
            Bienvenido, <strong className="sidebar__welcome-name">{sidebarUserLabel(session)}</strong>
          </p>
        ) : null}
        <nav className="nav" aria-label="Principal">
          <div className="nav-panel">
            <p className="nav-section-label">Menú</p>
            <NavLink end className={navClass} to="/" onClick={closeNav}>
              <span className="nav-link__icon">
                <IconDashboard />
              </span>
              <span className="nav-link__text">Dashboard</span>
            </NavLink>
            <NavLink className={navClass} to="/sites" onClick={closeNav}>
              <span className="nav-link__icon">
                <IconSites />
              </span>
              <span className="nav-link__text">Sitios</span>
            </NavLink>
            <NavLink className={navClass} to="/reports" onClick={closeNav}>
              <span className="nav-link__icon">
                <IconReports />
              </span>
              <span className="nav-link__text">Reportes</span>
            </NavLink>
            <NavLink className={navClass} to="/library" onClick={closeNav}>
              <span className="nav-link__icon">
                <IconLibrary />
              </span>
              <span className="nav-link__text">Biblioteca</span>
            </NavLink>
            <NavLink className={navClass} to="/assistant" onClick={closeNav}>
              <span className="nav-link__icon">
                <IconAssistant />
              </span>
              <span className="nav-link__text">Búsqueda inteligente</span>
            </NavLink>
            <NavLink className={navClass} to="/alerts" onClick={closeNav}>
              <span className="nav-link__icon">
                <IconAlerts />
              </span>
              <span className="nav-link__text">Alertas</span>
            </NavLink>
            {isAdmin ? (
              <NavLink className={navClass} to="/settings/monitoring" onClick={closeNav}>
                <span className="nav-link__icon">
                  <IconClock />
                </span>
                <span className="nav-link__text">Programación</span>
              </NavLink>
            ) : null}
            {isAdmin ? (
              <NavLink className={navClass} to="/settings/users" onClick={closeNav}>
                <span className="nav-link__icon">
                  <IconUsers />
                </span>
                <span className="nav-link__text">Usuarios</span>
              </NavLink>
            ) : null}

            {isAdmin ? (
              <>
                <div className="nav-panel__divider" role="presentation" />
                <NavLink className={navClassNew} to="/sites/new" onClick={closeNav}>
                  <span className="nav-link__icon">
                    <IconPlusSite />
                  </span>
                  <span className="nav-link__text">Nuevo sitio</span>
                </NavLink>
              </>
            ) : null}

            {showLogout ? (
              <>
                <div className="nav-panel__divider nav-panel__divider--before-logout" role="presentation" />
                <button
                  type="button"
                  className="btn ghost small nav-panel__logout"
                  disabled={sessionSnail !== null}
                  aria-busy={sessionSnail === "goodbye"}
                  onClick={() => {
                    closeNav();
                    setSessionSnail("goodbye");
                    window.setTimeout(() => {
                      setAuthToken(null);
                      setSessionDisplayName(null);
                      setShowLogout(false);
                      setSessionSnail(null);
                      void nav("/login", { replace: true });
                    }, 1750);
                  }}
                >
                  {sessionSnail === "goodbye" ? "Cerrando…" : "Cerrar sesión"}
                </button>
              </>
            ) : null}
          </div>
        </nav>
      </aside>
      <main className="main">
        <div className="main-inner">
          <ProfeEmailRedirect />
          {!authRequired ? (
            <div className="card layout-auth-banner" role="status">
              <strong>Sin inicio de sesión obligatorio:</strong> cualquiera con el enlace puede usar la aplicación. Para
              exigir usuario y contraseña, quien administra el sistema debe activar el acceso restringido en la
              configuración del servidor.
            </div>
          ) : null}
          <Outlet />
        </div>
      </main>
      </div>
    </div>
  );
}

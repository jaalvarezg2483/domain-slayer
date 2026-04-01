import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { hasAuthToken, setAuthToken } from "../api";
import { AppBrand } from "./AppBrand";
import {
  IconAlerts,
  IconAssistant,
  IconClock,
  IconDashboard,
  IconLibrary,
  IconPlusSite,
  IconSites,
  IconUsers,
} from "./NavIcons";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link active" : "nav-link";
}

function navClassNew({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--new active" : "nav-link nav-link--new";
}

export function Layout() {
  const nav = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  useEffect(() => {
    setShowLogout(hasAuthToken());
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <AppBrand variant="sidebar" />
        <nav className="nav" aria-label="Principal">
          <div className="nav-panel">
            <p className="nav-section-label">Menú</p>
            <NavLink end className={navClass} to="/">
              <span className="nav-link__icon">
                <IconDashboard />
              </span>
              <span className="nav-link__text">Dashboard</span>
            </NavLink>
            <NavLink className={navClass} to="/sites">
              <span className="nav-link__icon">
                <IconSites />
              </span>
              <span className="nav-link__text">Sitios</span>
            </NavLink>
            <NavLink className={navClass} to="/library">
              <span className="nav-link__icon">
                <IconLibrary />
              </span>
              <span className="nav-link__text">Biblioteca</span>
            </NavLink>
            <NavLink className={navClass} to="/assistant">
              <span className="nav-link__icon">
                <IconAssistant />
              </span>
              <span className="nav-link__text">Búsqueda inteligente</span>
            </NavLink>
            <NavLink className={navClass} to="/alerts">
              <span className="nav-link__icon">
                <IconAlerts />
              </span>
              <span className="nav-link__text">Alertas</span>
            </NavLink>
            <NavLink className={navClass} to="/settings/monitoring">
              <span className="nav-link__icon">
                <IconClock />
              </span>
              <span className="nav-link__text">Programación</span>
            </NavLink>
            <NavLink className={navClass} to="/settings/users">
              <span className="nav-link__icon">
                <IconUsers />
              </span>
              <span className="nav-link__text">Usuarios</span>
            </NavLink>

            <div className="nav-panel__divider" role="presentation" />

            <NavLink className={navClassNew} to="/sites/new">
              <span className="nav-link__icon">
                <IconPlusSite />
              </span>
              <span className="nav-link__text">Nuevo sitio</span>
            </NavLink>

            {showLogout ? (
              <>
                <div className="nav-panel__divider nav-panel__divider--before-logout" role="presentation" />
                <button
                  type="button"
                  className="btn ghost small nav-panel__logout"
                  onClick={() => {
                    setAuthToken(null);
                    setShowLogout(false);
                    void nav("/login", { replace: true });
                  }}
                >
                  Cerrar sesión
                </button>
              </>
            ) : null}
          </div>
        </nav>
      </aside>
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

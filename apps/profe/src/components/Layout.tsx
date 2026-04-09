import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  Users,
  BookOpen,
  Building2,
  Percent,
  ClipboardList,
  FileText,
  UserCog,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getElectronAuth } from '@/lib/electron-auth';
import { ThemeToggle } from '@/components/ThemeToggle';

interface LayoutProps {
  children: React.ReactNode;
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-[color,background-color,box-shadow] duration-150 ease-out',
        active
          ? 'bg-nav-active text-nav-active-foreground shadow-sm'
          : 'text-sidebar-foreground/90 hover:bg-accent/70 hover:text-accent-foreground',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user, refresh } = useAuth();

  async function handleLogout() {
    await getElectronAuth().logout();
    await refresh();
  }

  const browserPreview = typeof window !== 'undefined' && window.__GESTOR_BROWSER_PREVIEW__;
  const inventoryBridge = typeof window !== 'undefined' && window.__GESTOR_INVENTORY_BRIDGE__;

  return (
    <div className="min-h-screen bg-background">
      {browserPreview && inventoryBridge ? (
        <div className="border-b border-emerald-500/35 bg-emerald-500/10 px-4 py-2 text-center text-sm text-emerald-950 dark:text-emerald-100">
          <strong>Inventario Profe (integrado)</strong> — misma sesión JWT que Inventario de sitios. <strong>Instituciones</strong>{" "}
          se guardan en la base del servidor; otras pantallas pueden seguir en modo local hasta conectarlas al API. Escritorio
          completo con SQLite propia:{" "}
          <code className="rounded bg-background/80 px-1.5 py-0.5 text-xs">npm run dev:electron</code>.
        </div>
      ) : null}
      {browserPreview && !inventoryBridge ? (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-950 dark:text-amber-100">
          <strong>Vista previa en navegador</strong> — sin base de datos ni archivos reales. Para el escritorio completo:{' '}
          <code className="rounded bg-background/80 px-1.5 py-0.5 text-xs">npm run dev:electron</code>
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar min-h-screen">
          <div className="flex items-start justify-between gap-2 border-b border-sidebar-border p-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">Inventario Profe</h1>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">Gestión académica (módulo integrado)</p>
              {user ? (
                <p className="mt-3 truncate text-xs text-sidebar-foreground/80" title={user.email}>
                  <span className="font-medium text-sidebar-foreground">{user.name}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
                    {user.role}
                  </span>
                </p>
              ) : null}
            </div>
            <ThemeToggle className="h-9 w-9 shrink-0 text-sidebar-foreground/80 hover:bg-accent/80 hover:text-accent-foreground" />
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
            <NavItem to="/instituciones" icon={Building2} label="Instituciones" />
            <NavItem to="/periodos" icon={Calendar} label="Períodos" />
            <NavItem to="/grupos" icon={Users} label="Grupos" />
            <NavItem to="/cursos" icon={BookOpen} label="Cursos" />
            <NavItem to="/distribuciones" icon={Percent} label="Distribuciones" />
            <NavItem to="/rubricas" icon={ClipboardList} label="Rúbricas" />
            <NavItem to="/tipos-actividad" icon={FileText} label="Tipos de actividad" />
            {user?.role === 'admin' ? <NavItem to="/usuarios" icon={UserCog} label="Usuarios" /> : null}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-sidebar-border bg-card/50 hover:bg-card"
              type="button"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </aside>

        <main className="min-h-screen flex-1 overflow-auto p-6 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

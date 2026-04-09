import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Instituciones from './pages/Colegios';
import Periodos from './pages/Periodos';
import Grupos from './pages/Grupos';
import Cursos from './pages/Cursos';
import Distribuciones from './pages/Distribuciones';
import Rubricas from './pages/Rubricas';
import TiposActividad from './pages/TiposActividad';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Usuarios from './pages/Usuarios';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeToggle } from './components/ThemeToggle';

function FloatingThemeToggle() {
  return (
    <div className="pointer-events-auto fixed top-3 right-3 z-[200]">
      <ThemeToggle className="h-10 w-10 rounded-full border border-border/80 bg-card/95 shadow-card backdrop-blur-md" />
    </div>
  );
}

function AppRoutes() {
  const { loading, hasUsers, user, refresh } = useAuth();

  if (loading) {
    return (
      <>
        <FloatingThemeToggle />
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          Cargando…
        </div>
      </>
    );
  }

  if (!hasUsers) {
    return (
      <>
        <FloatingThemeToggle />
        <Routes>
          <Route path="*" element={<Register onSuccess={refresh} />} />
        </Routes>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <FloatingThemeToggle />
        <Routes>
          <Route path="/login" element={<Login onSuccess={refresh} />} />
          <Route path="/recuperar" element={<ForgotPassword />} />
          <Route path="/restablecer" element={<ResetPassword onSuccess={refresh} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <Layout>
      <Routes key={user.userId}>
        <Route path="/" element={<Navigate to="/instituciones" replace />} />
        <Route path="/instituciones" element={<Instituciones />} />
        <Route path="/periodos" element={<Periodos />} />
        <Route path="/grupos" element={<Grupos />} />
        <Route path="/cursos" element={<Cursos />} />
        <Route path="/distribuciones" element={<Distribuciones />} />
        <Route path="/rubricas" element={<Rubricas />} />
        <Route path="/tipos-actividad" element={<TiposActividad />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="*" element={<Navigate to="/instituciones" replace />} />
      </Routes>
    </Layout>
  );
}

function routerBasename(): string {
  const base = import.meta.env.BASE_URL;
  if (base === "/" || !base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter
        basename={routerBasename()}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

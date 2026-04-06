import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { SiteList } from "./pages/SiteList";
import { SiteForm } from "./pages/SiteForm";
import { SiteDetail } from "./pages/SiteDetail";
import { Alerts } from "./pages/Alerts";
import { Library } from "./pages/Library";
import { MonitoringScheduleSettings } from "./pages/MonitoringScheduleSettings";
import { Reports } from "./pages/Reports";
import { UsersSettings } from "./pages/UsersSettings";
import { LibraryAssistant } from "./pages/LibraryAssistant";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="library" element={<Library />} />
        <Route path="assistant" element={<LibraryAssistant />} />
        <Route path="sites" element={<SiteList />} />
        <Route path="reports" element={<Reports />} />
        <Route path="sites/new" element={<SiteForm />} />
        <Route path="sites/:id/edit" element={<SiteForm />} />
        <Route path="sites/:id" element={<SiteDetail />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="settings/monitoring" element={<MonitoringScheduleSettings />} />
        <Route path="settings/users" element={<UsersSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

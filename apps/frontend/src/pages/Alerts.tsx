import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { ConfirmModal } from "../components/ConfirmModal";
import type { AlertRow } from "../types";

export function Alerts() {
  const [items, setItems] = useState<AlertRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolveAllOpen, setResolveAllOpen] = useState(false);

  const load = () => {
    api.alerts
      .list({ isResolved: "false" })
      .then((r) => setItems(r.items as AlertRow[]))
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const resolveAll = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api.alerts.resolveAllOpen();
      setResolveAllOpen(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Alertas abiertas</h1>
        {items.length > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={() => setResolveAllOpen(true)}>
            Limpiar todas
          </button>
        )}
      </div>
      {err && <div className="card error">{err}</div>}
      <div className="card pad-0">
        <table className="table">
          <thead>
            <tr>
              <th>Severidad</th>
              <th>Mensaje</th>
              <th>Sitio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No hay alertas abiertas.
                </td>
              </tr>
            )}
            {items.map((a) => (
              <tr key={a.id}>
                <td>
                  <Badge kind={a.severity} variant="severity" />
                </td>
                <td>{a.message}</td>
                <td>
                  <Link to={`/sites/${a.siteId}`}>Ver sitio</Link>
                </td>
                <td>
                  <button type="button" className="btn small" onClick={() => api.alerts.resolve(a.id).then(load)}>
                    Resolver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={resolveAllOpen}
        title="Marcar alertas como resueltas"
        message="¿Marcar como resueltas todas las alertas abiertas? No se borran del historial; solo dejan de figurar como pendientes."
        confirmLabel="Sí, marcar todas"
        cancelLabel="Cancelar"
        busy={busy}
        busyLabel="Procesando…"
        onCancel={() => {
          if (!busy) setResolveAllOpen(false);
        }}
        onConfirm={() => void resolveAll()}
      />
    </div>
  );
}

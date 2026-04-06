import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthMode } from "../auth-context";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { ConfirmModal } from "../components/ConfirmModal";
import { isAdminSession } from "../lib/auth-session";
import { labelAlertType } from "../lib/status-labels";
import type { AlertRow, SiteRow } from "../types";

type SiteMeta = { siteName: string; domain: string };

function groupAlertsBySite(items: AlertRow[]): Map<string, AlertRow[]> {
  const m = new Map<string, AlertRow[]>();
  for (const a of items) {
    const list = m.get(a.siteId) ?? [];
    list.push(a);
    m.set(a.siteId, list);
  }
  return m;
}

function sortSiteIds(ids: string[], sitesById: Map<string, SiteMeta>): string[] {
  return [...ids].sort((a, b) => {
    const na = (sitesById.get(a)?.siteName ?? `\uffff${a}`).toLowerCase();
    const nb = (sitesById.get(b)?.siteName ?? `\uffff${b}`).toLowerCase();
    return na.localeCompare(nb, "es");
  });
}

export function Alerts() {
  const { authRequired } = useAuthMode();
  const canResolve = !authRequired || isAdminSession();
  const [items, setItems] = useState<AlertRow[]>([]);
  const [sitesById, setSitesById] = useState<Map<string, SiteMeta>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolveAllOpen, setResolveAllOpen] = useState(false);
  const [search, setSearch] = useState("");
  /** Sitios contraídos (si no está en el set, el grupo está expandido). */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  /** Tras la primera carga con datos, todos los grupos empiezan cerrados; no se resetea al resolver alertas. */
  const initialCollapsedApplied = useRef(false);

  const load = useCallback(() => {
    setErr(null);
    Promise.all([
      api.alerts.list({ isResolved: "false", limit: 500 }),
      api.sites.list({ limit: 500 }),
    ])
      .then(([ar, sr]) => {
        setItems((ar.items ?? []) as AlertRow[]);
        const m = new Map<string, SiteMeta>();
        for (const s of (sr.items ?? []) as SiteRow[]) {
          m.set(s.id, { siteName: s.siteName, domain: s.domain });
        }
        setSitesById(m);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (items.length === 0) {
      initialCollapsedApplied.current = false;
      setCollapsed(new Set());
      return;
    }
    if (initialCollapsedApplied.current) return;
    initialCollapsedApplied.current = true;
    setCollapsed(new Set([...new Set(items.map((a) => a.siteId))]));
  }, [items]);

  const bySite = useMemo(() => groupAlertsBySite(items), [items]);

  const groupsSorted = useMemo(() => {
    return sortSiteIds([...bySite.keys()], sitesById).map((siteId) => ({
      siteId,
      alerts: bySite.get(siteId) ?? [],
    }));
  }, [bySite, sitesById]);

  const searchNorm = search.trim().toLowerCase();

  /** Si el buscador coincide con el sitio, se muestran todas sus alertas; si no, solo las filas que coinciden. */
  const filteredGroups = useMemo(() => {
    return groupsSorted
      .map(({ siteId, alerts }) => {
        if (!searchNorm) return { siteId, alerts };
        const meta = sitesById.get(siteId);
        const name = (meta?.siteName ?? "").toLowerCase();
        const dom = (meta?.domain ?? "").toLowerCase();
        const siteMatch =
          name.includes(searchNorm) || dom.includes(searchNorm) || siteId.toLowerCase().includes(searchNorm);
        if (siteMatch) return { siteId, alerts };
        const sub = alerts.filter((a) => {
          const typeLabel = labelAlertType(a.alertType).toLowerCase();
          return (
            a.message.toLowerCase().includes(searchNorm) ||
            typeLabel.includes(searchNorm) ||
            a.alertType.toLowerCase().includes(searchNorm)
          );
        });
        return { siteId, alerts: sub };
      })
      .filter((g) => g.alerts.length > 0);
  }, [groupsSorted, searchNorm, sitesById]);

  const toggleSite = (siteId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  const expandAllFiltered = () => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const g of filteredGroups) next.delete(g.siteId);
      return next;
    });
  };

  const collapseAllFiltered = () => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const g of filteredGroups) next.add(g.siteId);
      return next;
    });
  };

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
        {canResolve && items.length > 0 ? (
          <button type="button" className="btn" disabled={busy} onClick={() => setResolveAllOpen(true)}>
            Limpiar todas
          </button>
        ) : null}
      </div>
      {err && <div className="card error">{err}</div>}

      <div className="card pad-0 alerts-page">
        <div className="alerts-page__toolbar">
          <label className="alerts-page__search-label">
            <span className="sr-only">Buscar alertas</span>
            <input
              type="search"
              className="input"
              placeholder="Buscar por sitio, dominio, tipo o mensaje…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {filteredGroups.length > 1 ? (
            <div className="alerts-page__bulk-toggle row gap">
              <button type="button" className="btn ghost small" onClick={expandAllFiltered}>
                Expandir todos
              </button>
              <button type="button" className="btn ghost small" onClick={collapseAllFiltered}>
                Contraer todos
              </button>
            </div>
          ) : null}
        </div>

        {items.length === 0 && (
          <p className="muted alerts-page__empty" style={{ padding: "1.25rem" }}>
            No hay alertas abiertas.
          </p>
        )}

        {items.length > 0 && filteredGroups.length === 0 && (
          <p className="muted alerts-page__empty" style={{ padding: "1.25rem" }}>
            Ningún sitio coincide con «{search.trim()}». Pruebe otro término o borre el filtro.
          </p>
        )}

        {filteredGroups.map(({ siteId, alerts }) => {
          const meta = sitesById.get(siteId);
          const title = meta?.siteName ?? "Sitio sin datos en inventario";
          const domain = meta?.domain ?? "";
          const open = !collapsed.has(siteId);
          const panelId = `alerts-site-${siteId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

          return (
            <div key={siteId} className="alerts-site-group">
              <button
                type="button"
                className="alerts-site-group__header"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggleSite(siteId)}
              >
                <span className="alerts-site-group__chevron" aria-hidden>
                  ›
                </span>
                <span className="alerts-site-group__title-block">
                  <span className="alerts-site-group__title">{title}</span>
                  {domain ? <span className="alerts-site-group__domain muted small">{domain}</span> : null}
                  <span className="alerts-site-group__count muted small">
                    {alerts.length} alerta{alerts.length === 1 ? "" : "s"}
                  </span>
                </span>
                <Link
                  to={`/sites/${siteId}`}
                  className="alerts-site-group__link small"
                  onClick={(e) => e.stopPropagation()}
                >
                  Ficha del sitio
                </Link>
              </button>
              {open ? (
                <div className="alerts-site-group__panel" id={panelId} role="region">
                  <table className="table alerts-site-group__table">
                    <thead>
                      <tr>
                        <th>Severidad</th>
                        <th>Tipo</th>
                        <th>Mensaje</th>
                        {canResolve ? <th></th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <Badge kind={a.severity} variant="severity" />
                          </td>
                          <td className="muted small">{labelAlertType(a.alertType)}</td>
                          <td>{a.message}</td>
                          {canResolve ? (
                            <td>
                              <button
                                type="button"
                                className="btn small"
                                onClick={() => void api.alerts.resolve(a.id).then(load)}
                              >
                                Resolver
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={canResolve && resolveAllOpen}
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

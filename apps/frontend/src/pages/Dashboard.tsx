import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { IconEye } from "../components/NavIcons";
import { ExpirySolutionModal } from "../components/ExpirySolutionModal";
import { SiteActiveBadge } from "../components/SiteActiveBadge";
import { TablePagination } from "../components/TablePagination";
import { buildSitesExpiryProximity, type SiteExpiryProximityRow } from "../lib/expiry-proximity";
import { expiryLineText } from "../lib/expiry-line-text";
import {
  domainExpiryCellClass,
  formatDashboardLastCheck,
  formatListDate,
  sslExpiryCellClass,
} from "../lib/site-table-dates";
import type { AlertRow, SiteRow } from "../types";

const DASH_SITES_PAGE_SIZE = 10;

export function Dashboard() {
  const [data, setData] = useState<{ sites: SiteRow[]; alerts: AlertRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expiryModalRow, setExpiryModalRow] = useState<SiteExpiryProximityRow | null>(null);
  const [dashSitePage, setDashSitePage] = useState(1);

  const reload = () => {
    api.dashboard
      .summary()
      .then((d) => {
        const sites = (d.sites as { items: SiteRow[] }).items ?? [];
        const alerts = (d.alerts as { items: AlertRow[] }).items ?? [];
        setData({ sites, alerts });
      })
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!data) return;
    const maxP = Math.max(1, Math.ceil(data.sites.length / DASH_SITES_PAGE_SIZE));
    setDashSitePage((p) => Math.min(p, maxP));
  }, [data?.sites.length]);

  const expiryRows = useMemo(() => {
    if (!data) return [];
    return buildSitesExpiryProximity(data.sites);
  }, [data]);

  /** El API ya devuelve sitios ordenados por proximidad (igual que el inventario). */
  const dashSiteSlice = useMemo(() => {
    if (!data) return [];
    const start = (dashSitePage - 1) * DASH_SITES_PAGE_SIZE;
    return data.sites.slice(start, start + DASH_SITES_PAGE_SIZE);
  }, [data, dashSitePage]);

  if (err) return <div className="card error">{err}</div>;
  if (!data) return <div className="muted">Cargando…</div>;

  const expiryRedSites = expiryRows.filter((r) => r.worst === "red").length;
  const expiryOrangeSites = expiryRows.filter((r) => r.worst === "orange").length;

  return (
    <div className="stack dashboard-page">
      <h1>Panel general</h1>
      <div className="grid stats dashboard-stats" aria-label="Resumen del inventario">
        <div className="card stat">
          <div className="stat-label">Sitios activos</div>
          <div className="stat-value">{data.sites.filter((s) => s.isActive !== false).length}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Alertas abiertas</div>
          <div className="stat-value">{data.alerts.length}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Vencen en menos de 5 días</div>
          <div className="stat-value text-bad">{expiryRedSites}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Vencen en 5 a 10 días</div>
          <div className="stat-value text-warn-strong">{expiryOrangeSites}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Alertas de Vencimiento</h2>
          <Link to="/alerts" className="muted small">
            Otras alertas (HTTP, DNS, etc.)
          </Link>
        </div>
        {expiryRows.length === 0 ? (
          <p className="muted">No hay sitios próximos a vencer.</p>
        ) : (
          <>
            <p className="muted small" style={{ marginBottom: "0.75rem" }}>
              Las fechas vienen de la última revisión de cada sitio. Cuando renueve, vuelva a revisar el sitio: si el dominio
              y el certificado quedan fuera de la ventana de aviso, la alerta se quita sola. En «Notas» ve las pautas de
              resolución guardadas.
            </p>
            <div className="table-scroll table-scroll--dashboard-fit">
            <table className="table expiry-alert-table table--dashboard-expiry">
              <thead>
                <tr>
                  <th>Sitio</th>
                  <th>Vencimiento</th>
                  <th>Información de solución</th>
                </tr>
              </thead>
              <tbody>
                {expiryRows.map((row) => {
                  const s = row.site as SiteRow;
                  const hasNotes =
                    !!(s.sslResolutionNotes?.trim() || s.domainResolutionNotes?.trim());
                  return (
                    <tr
                      key={row.site.id}
                      className={
                        row.worst === "red" ? "expiry-row expiry-row--red" : "expiry-row expiry-row--orange"
                      }
                    >
                      <td>
                        <Link to={`/sites/${row.site.id}`}>{row.site.siteName}</Link>
                        <div className="muted small dashboard-expiry-domain">{row.site.domain}</div>
                      </td>
                      <td>
                        {row.lines.map((line) => (
                          <div
                            key={line.kind}
                            className={line.urgency === "red" ? "expiry-detail--red" : "expiry-detail--orange"}
                          >
                            {expiryLineText(line, row.site)}
                          </div>
                        ))}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn small expiry-solution-btn"
                          onClick={() => setExpiryModalRow(row)}
                        >
                          <span className="expiry-solution-btn__icon" aria-hidden>
                            <IconEye />
                          </span>
                          Notas
                        </button>
                        {hasNotes ? (
                          <div className="muted small expiry-notes-hint" title="Hay notas de resolución">
                            Notas guardadas
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      <ExpirySolutionModal
        row={expiryModalRow}
        onClose={() => setExpiryModalRow(null)}
        onSaved={() => reload()}
      />

      <div className="card">
        <h2>Estado por sitio</h2>
        <div className="table-scroll table-scroll--dashboard-fit">
        <table className="table table--dashboard-sites">
          <thead>
            <tr>
              <th>Sitio</th>
              <th title="Los inactivos no se incluyen al revisar todos">Estado</th>
              <th>Salud</th>
              <th>SSL</th>
              <th title="Vencimiento del certificado (HTTPS)">SSL vence</th>
              <th title="Vencimiento del registro de dominio">Dominio exp.</th>
              <th>Última revisión</th>
            </tr>
          </thead>
          <tbody>
            {dashSiteSlice.map((s) => {
              const chk = formatDashboardLastCheck(s.lastCheckedAt);
              return (
                <tr key={s.id}>
                  <td>
                    <Link to={`/sites/${s.id}`}>{s.siteName}</Link>
                    <div className="muted small">{s.domain}</div>
                  </td>
                  <td>
                    <SiteActiveBadge isActive={s.isActive !== false} />
                  </td>
                  <td>
                    <Badge kind={s.healthStatus} variant="health" />
                  </td>
                  <td>
                    <Badge kind={s.sslStatus} variant="ssl" />
                  </td>
                  <td className={sslExpiryCellClass(s)}>{formatListDate(s.sslValidToFinal ?? s.sslValidTo)}</td>
                  <td className={domainExpiryCellClass(s)}>{formatListDate(s.domainExpiryFinal)}</td>
                  <td className="muted small table-cell--wrap" title={chk.title || undefined}>
                    {chk.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <TablePagination
          page={dashSitePage}
          pageSize={DASH_SITES_PAGE_SIZE}
          total={data.sites.length}
          onPageChange={setDashSitePage}
          itemLabel="sitios del panel"
        />
      </div>
    </div>
  );
}

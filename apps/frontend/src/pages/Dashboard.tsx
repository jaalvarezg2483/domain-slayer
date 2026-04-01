import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { IconEye } from "../components/NavIcons";
import { ExpirySolutionModal } from "../components/ExpirySolutionModal";
import { SiteActiveBadge } from "../components/SiteActiveBadge";
import { buildSitesExpiryProximity, type SiteExpiryProximityRow } from "../lib/expiry-proximity";
import { expiryLineText } from "../lib/expiry-line-text";
import { domainExpiryCellClass, formatListDate, sslExpiryCellClass } from "../lib/site-table-dates";
import type { AlertRow, SiteRow } from "../types";

export function Dashboard() {
  const [data, setData] = useState<{ sites: SiteRow[]; alerts: AlertRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [expiryModalRow, setExpiryModalRow] = useState<SiteExpiryProximityRow | null>(null);

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

  const expiryRows = useMemo(() => {
    if (!data) return [];
    return buildSitesExpiryProximity(data.sites);
  }, [data]);

  if (err) return <div className="card error">{err}</div>;
  if (!data) return <div className="muted">Cargando…</div>;

  const critical = data.alerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="stack">
      <h1>Panel general</h1>
      <div className="grid stats">
        <div className="card stat">
          <div className="stat-label">Sitios activos</div>
          <div className="stat-value">{data.sites.filter((s) => s.isActive !== false).length}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Alertas abiertas</div>
          <div className="stat-value">{data.alerts.length}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Críticas</div>
          <div className="stat-value text-bad">{critical}</div>
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
          <p className="muted">
            Ningún certificado ni dominio en esta ventana (≤10 días o vencido). En rojo: vencido o menos de 3 días.
          </p>
        ) : (
          <>
            <p className="muted small" style={{ marginBottom: "0.75rem" }}>
              Las filas salen de las fechas del último chequeo. Tras renovar, ejecute un chequeo en el sitio: si dominio y
              SSL quedan fuera de la ventana de aviso, la alerta desaparece sola. Use «Ver notas» para notas de resolución
              guardadas en el servidor.
            </p>
            <table className="table expiry-alert-table">
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
                      className={row.worst === "red" ? "expiry-row expiry-row--red" : "expiry-row expiry-row--yellow"}
                    >
                      <td>
                        <Link to={`/sites/${row.site.id}`}>{row.site.siteName}</Link>
                        <div className="muted small">{row.site.domain}</div>
                      </td>
                      <td>
                        {row.lines.map((line) => (
                          <div
                            key={line.kind}
                            className={line.urgency === "red" ? "expiry-detail--red" : "expiry-detail--yellow"}
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
                          Ver notas
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
        <table className="table">
          <thead>
            <tr>
              <th>Sitio</th>
              <th title="Activo: incluido en chequeos globales">Estado</th>
              <th>Salud</th>
              <th>SSL</th>
              <th title="Vencimiento del certificado TLS (HTTPS)">SSL vence</th>
              <th title="Vencimiento del registro de dominio">Dominio exp.</th>
              <th>Último chequeo</th>
            </tr>
          </thead>
          <tbody>
            {data.sites.slice(0, 12).map((s) => (
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
                <td className={sslExpiryCellClass(s)}>{formatListDate(s.sslValidTo)}</td>
                <td className={domainExpiryCellClass(s)}>{formatListDate(s.domainExpiryFinal)}</td>
                <td className="muted small">
                  {s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString("es-ES") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

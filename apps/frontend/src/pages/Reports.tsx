import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { Spinner } from "../components/Spinner";
import {
  aggregateActive,
  aggregateAlertSeverity,
  aggregateAlertType,
  aggregateCheckStatus,
  aggregateDns,
  aggregateDomainExpiry,
  aggregateEnvironment,
  aggregateHealth,
  aggregateHttps,
  aggregateSsl,
  type NamedCount,
  type SiteReportRow,
  reportSummary,
} from "../lib/site-reports-aggregate";
import type { AlertRow } from "../types";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
};

async function fetchAllSites(): Promise<SiteReportRow[]> {
  const all: SiteReportRow[] = [];
  let offset = 0;
  const limit = 500;
  for (;;) {
    const r = await api.sites.list({ limit, offset, sortBy: "updated_at" });
    const items = (r.items ?? []) as SiteReportRow[];
    all.push(...items);
    const total = r.total ?? 0;
    if (items.length < limit || all.length >= total) break;
    offset += limit;
  }
  return all;
}

async function fetchAllOpenAlerts(): Promise<AlertRow[]> {
  const all: AlertRow[] = [];
  let offset = 0;
  const limit = 500;
  for (;;) {
    const r = await api.alerts.list({ isResolved: "false", limit, offset });
    const items = (r.items ?? []) as AlertRow[];
    all.push(...items);
    const total = r.total ?? 0;
    if (items.length < limit || all.length >= total) break;
    offset += limit;
  }
  return all;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="card report-chart-card">
      <h2 className="report-chart-card__title">{title}</h2>
      {subtitle ? <p className="report-chart-card__sub muted small">{subtitle}</p> : null}
      <div className="report-chart-card__body">{children}</div>
    </div>
  );
}

function DonutChart({ data, emptyHint }: { data: NamedCount[]; emptyHint: string }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="muted small report-chart-card__empty">{emptyHint}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((row) => (
            <Cell key={row.key} fill={row.fill} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [v, "Sitios"]} contentStyle={TOOLTIP_STYLE} />
        <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarChart({ data, emptyHint, valueLabel = "sitios" }: { data: NamedCount[]; emptyHint: string; valueLabel?: string }) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="muted small report-chart-card__empty">{emptyHint}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36 + 80)}>
      <BarChart layout="vertical" data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" stroke="var(--muted)" tick={{ fill: "var(--muted)", fontSize: 11 }} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={148} tick={{ fill: "var(--muted)", fontSize: 10 }} stroke="var(--border)" />
        <Tooltip formatter={(v: number) => [v, valueLabel]} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {data.map((row) => (
            <Cell key={row.key} fill={row.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalBarChart({
  data,
  emptyHint,
  valueLabel = "sitios",
}: {
  data: NamedCount[];
  emptyHint: string;
  valueLabel?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="muted small report-chart-card__empty">{emptyHint}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" stroke="var(--muted)" tick={{ fill: "var(--muted)", fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
        <YAxis stroke="var(--muted)" tick={{ fill: "var(--muted)", fontSize: 11 }} allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, valueLabel]} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((row) => (
            <Cell key={row.key} fill={row.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Reports() {
  const [sites, setSites] = useState<SiteReportRow[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [s, a] = await Promise.all([fetchAllSites(), fetchAllOpenAlerts()]);
      setSites(s);
      setAlerts(a);
    } catch (e) {
      setErr((e as Error).message);
      setSites(null);
      setAlerts(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const health = useMemo(() => (sites ? aggregateHealth(sites) : []), [sites]);
  const ssl = useMemo(() => (sites ? aggregateSsl(sites) : []), [sites]);
  const env = useMemo(() => (sites ? aggregateEnvironment(sites) : []), [sites]);
  const active = useMemo(() => (sites ? aggregateActive(sites) : []), [sites]);
  const check = useMemo(() => (sites ? aggregateCheckStatus(sites) : []), [sites]);
  const https = useMemo(() => (sites ? aggregateHttps(sites) : []), [sites]);
  const dns = useMemo(() => (sites ? aggregateDns(sites) : []), [sites]);
  const domExp = useMemo(() => (sites ? aggregateDomainExpiry(sites) : []), [sites]);
  const sev = useMemo(() => (alerts ? aggregateAlertSeverity(alerts) : []), [alerts]);
  const types = useMemo(() => (alerts ? aggregateAlertType(alerts) : []), [alerts]);
  const summary = useMemo(
    () => (sites && alerts ? reportSummary(sites, alerts) : null),
    [sites, alerts]
  );

  if (loading && !sites) {
    return (
      <div className="stack narrow reports-page">
        <h1>Reportes</h1>
        <p className="muted">
          <Spinner size="sm" /> Cargando inventario…
        </p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="stack narrow reports-page">
        <h1>Reportes</h1>
        <div className="card error">{err}</div>
        <button type="button" className="btn" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="stack reports-page">
      <div className="row-between reports-page__head">
        <div>
          <h1>Reportes de sitios y salud</h1>
          <p className="muted small">
            Vista agregada del inventario y alertas abiertas. Los gráficos usan los mismos estados que el listado de sitios y la
            página de alertas.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" /> Actualizando…
            </>
          ) : (
            "Actualizar"
          )}
        </button>
      </div>

      {summary ? (
        <div className="grid stats reports-stats" aria-label="Resumen de reportes">
          <div className="card stat">
            <div className="stat-label">Sitios en inventario</div>
            <div className="stat-value">{summary.total}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Activos</div>
            <div className="stat-value">{summary.active}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Salud «Correcto»</div>
            <div className="stat-value text-ok">{summary.healthy}</div>
            <div className="muted small" style={{ marginTop: "0.25rem" }}>
              {summary.pctHealthy}% del total
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">Alertas abiertas</div>
            <div className="stat-value">{summary.openAlerts}</div>
            <Link to="/alerts" className="small" style={{ display: "block", marginTop: "0.25rem" }}>
              Ver alertas →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="reports-grid">
        <ChartCard title="Salud general" subtitle="Resumen del estado de salud tras la última revisión.">
          <DonutChart data={health} emptyHint="No hay sitios para mostrar." />
        </ChartCard>
        <ChartCard title="Certificado SSL" subtitle="Estado del certificado según el inventario y la última revisión.">
          <DonutChart data={ssl} emptyHint="No hay sitios para mostrar." />
        </ChartCard>
        <ChartCard title="Ambiente" subtitle="Producción, staging o desarrollo.">
          <HorizontalBarChart data={env} emptyHint="Sin datos de ambiente." />
        </ChartCard>
        <ChartCard title="Inventario activo" subtitle="Los inactivos no entran en «Chequear todos».">
          <DonutChart data={active} emptyHint="No hay sitios." />
        </ChartCard>
        <ChartCard title="Última revisión" subtitle="Resultado global del monitoreo por sitio.">
          <VerticalBarChart data={check} emptyHint="Sin datos de revisión todavía." />
        </ChartCard>
        <ChartCard title="HTTPS" subtitle="Respuesta HTTP(s) del sitio.">
          <VerticalBarChart data={https} emptyHint="Sin datos HTTPS." />
        </ChartCard>
        <ChartCard title="DNS" subtitle="Estado de resolución DNS registrado.">
          <VerticalBarChart data={dns} emptyHint="Sin datos DNS." />
        </ChartCard>
        <ChartCard title="Vencimiento de dominio" subtitle="Según fecha efectiva y política del panel.">
          <VerticalBarChart data={domExp} emptyHint="Sin datos de dominio." />
        </ChartCard>
        <ChartCard title="Alertas abiertas por severidad" subtitle="Solo alertas no resueltas.">
          {sev.length === 0 ? (
            <p className="muted small report-chart-card__empty">
              No hay alertas abiertas.{" "}
              <Link to="/alerts">Ir a alertas</Link>
            </p>
          ) : (
            <VerticalBarChart data={sev} emptyHint="Sin alertas." valueLabel="alertas" />
          )}
        </ChartCard>
        <ChartCard title="Alertas abiertas por tipo" subtitle="Clasificación técnica (SSL, dominio, HTTP…).">
          {types.length === 0 ? (
            <p className="muted small report-chart-card__empty">No hay alertas abiertas.</p>
          ) : (
            <HorizontalBarChart data={types} emptyHint="Sin alertas." valueLabel="alertas" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { SiteActiveBadge } from "../components/SiteActiveBadge";
import { IconCheckCircle, IconRefreshCw, IconSearch } from "../components/NavIcons";
import { domainExpiryCellClass, formatListDate, sslExpiryCellClass } from "../lib/site-table-dates";
import { labelEnvironment } from "../lib/status-labels";
import type { SiteRow } from "../types";

export function SiteList() {
  const [items, setItems] = useState<SiteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const checkingLockRef = useRef(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [checkSuccessOpen, setCheckSuccessOpen] = useState(false);

  const load = () => {
    setErr(null);
    return api.sites
      .list({ search })
      .then((r) => {
        setItems(r.items as SiteRow[]);
        setTotal(r.total);
      })
      .catch((e: Error) => setErr(e.message));
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial solo
  }, []);

  useEffect(() => {
    if (!checkSuccessOpen) return;
    const t = window.setTimeout(() => setCheckSuccessOpen(false), 6000);
    return () => window.clearTimeout(t);
  }, [checkSuccessOpen]);

  const runCheckAll = async () => {
    if (checkingLockRef.current || checkingAll) return;
    checkingLockRef.current = true;
    setCheckErr(null);
    setCheckSuccessOpen(false);
    setCheckingAll(true);
    try {
      await api.monitoring.checkAll();
      await load();
      setCheckSuccessOpen(true);
    } catch (e) {
      setCheckErr((e as Error).message);
    } finally {
      checkingLockRef.current = false;
      setCheckingAll(false);
    }
  };

  return (
    <div className="stack" aria-busy={checkingAll}>
      <div className="row-between">
        <h1>Sitios ({total})</h1>
      </div>
      {checkingAll && (
        <div className="loading-banner" role="status" aria-live="polite">
          <span className="loading-banner__orbit" aria-hidden />
          <span>Revisando</span>
        </div>
      )}
      {checkSuccessOpen && (
        <div className="flash-notice flash-notice--success" role="status" aria-live="polite">
          <span className="flash-notice__icon" aria-hidden>
            <IconCheckCircle />
          </span>
          <div className="flash-notice__content">
            <span className="flash-notice__title">Chequeo completado</span>
            <span className="flash-notice__text">
              Sitios web revisados; las fechas de caducidad de SSL y de dominio quedaron actualizadas.
            </span>
          </div>
          <button
            type="button"
            className="flash-notice__dismiss"
            aria-label="Cerrar aviso"
            onClick={() => setCheckSuccessOpen(false)}
          >
            ×
          </button>
        </div>
      )}
      {checkErr && <div className="card error">{checkErr}</div>}
      <div
        className={`card sites-toolbar${checkingAll ? " sites-toolbar--busy" : ""}`}
        aria-busy={checkingAll}
      >
        <div className="sites-toolbar__search">
          <label className="sites-toolbar__input-wrap">
            <span className="sr-only">Buscar por nombre o dominio</span>
            <span className="sites-toolbar__input-icon" aria-hidden>
              <IconSearch />
            </span>
            <input
              className="input sites-toolbar__input"
              placeholder="Buscar por nombre o dominio…"
              value={search}
              disabled={checkingAll}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !checkingAll && void load()}
            />
          </label>
        </div>
        <div className="sites-toolbar__actions">
          <button type="button" className="btn primary sites-toolbar__btn" disabled={checkingAll} onClick={() => void load()}>
            Buscar
          </button>
          <button
            type="button"
            className="btn btn-check-all sites-toolbar__btn"
            disabled={checkingAll}
            aria-busy={checkingAll}
            title="Ejecutar chequeo SSL, DNS y HTTP en todos los sitios"
            onClick={() => void runCheckAll()}
          >
            {checkingAll ? (
              <>
                <span className="spinner-ring spinner-ring--sm" aria-hidden />
                Revisando
              </>
            ) : (
              <>
                <IconRefreshCw />
                Chequear todos
              </>
            )}
          </button>
        </div>
      </div>
      {err && <div className="card error">{err}</div>}
      <div className="card pad-0">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Ambiente</th>
              <th title="Si está inactivo, no entra en chequeos globales">Estado</th>
              <th>Salud</th>
              <th>SSL</th>
              <th title="Vencimiento del certificado TLS (HTTPS)">SSL vence</th>
              <th title="Vencimiento del registro de dominio">Dominio exp.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/sites/${s.id}`}>{s.siteName}</Link>
                  <div className="muted small">{s.domain}</div>
                </td>
                <td>{labelEnvironment(s.environment)}</td>
                <td>
                  <SiteActiveBadge isActive={s.isActive !== false} />
                </td>
                <td>
                  <Badge kind={s.healthStatus} variant="health" />
                </td>
                <td>
                  <Badge kind={s.sslStatus} variant="ssl" />
                </td>
                <td className={sslExpiryCellClass(s)} title={s.sslValidTo ? "Fin de validez del certificado TLS" : undefined}>
                  {formatListDate(s.sslValidTo)}
                </td>
                <td className={domainExpiryCellClass(s)} title={s.domainExpiryFinal ? "Fecha fin de dominio (la que usa el sistema)" : undefined}>
                  {formatListDate(s.domainExpiryFinal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

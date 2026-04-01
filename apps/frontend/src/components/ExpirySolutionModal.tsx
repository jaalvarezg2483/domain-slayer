import { useEffect, useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge } from "./Badge";
import { ExpiryContextBlock } from "./ExpiryContextBlock";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";
import { notesMatchDb } from "../lib/draft-after-save";
import { expiryLineText } from "../lib/expiry-line-text";
import type { SiteExpiryProximityRow } from "../lib/expiry-proximity";
import type { SiteRow } from "../types";

type Props = {
  row: SiteExpiryProximityRow | null;
  onClose: () => void;
  onSaved?: () => void;
};

const esDate: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" };

export function ExpirySolutionModal({ row, onClose, onSaved }: Props) {
  const [sslNotes, setSslNotes] = useState("");
  const [domainNotes, setDomainNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!row) return;
    const s = row.site as SiteRow;
    setSslNotes(s.sslResolutionNotes ?? "");
    setDomainNotes(s.domainResolutionNotes ?? "");
  }, [row?.site.id]);

  useEffect(() => {
    if (!row) return;
    const siteId = row.site.id;
    setErr(null);

    let cancelled = false;
    setLoadingNotes(true);
    void api.sites
      .get(siteId)
      .then((fresh) => {
        if (cancelled) return;
        const f = fresh as SiteRow;
        setSslNotes(f.sslResolutionNotes ?? "");
        setDomainNotes(f.domainResolutionNotes ?? "");
      })
      .catch(() => {
        /* ya tenemos datos del listado */
      })
      .finally(() => {
        if (!cancelled) setLoadingNotes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [row?.site.id]);

  if (!row) return null;

  const site = row.site as SiteRow;
  const title = `Resolución: ${site.siteName}`;
  const hasSslLine = row.lines.some((l) => l.kind === "ssl");
  const hasDomLine = row.lines.some((l) => l.kind === "domain");
  /** Si solo vence el dominio, la fila no incluye línea SSL y el modal ocultaba el bloque SSL aunque hubiera notas guardadas ahí (columna «Certificado SSL» en la ficha). */
  const sslNotesEffective = (sslNotes || site.sslResolutionNotes || "").trim();
  const domainNotesEffective = (domainNotes || site.domainResolutionNotes || "").trim();
  const showSslSection = hasSslLine || (hasDomLine && !hasSslLine && Boolean(sslNotesEffective));
  /** Evita dos cuadros de notas vacíos: si solo hay alerta de dominio y el texto está en sslResolutionNotes, no mostrar «Cómo pagar…» duplicado. */
  const showDomainResolutionTextarea =
    hasDomLine && (hasSslLine || domainNotesEffective.length > 0 || sslNotesEffective.length === 0);
  const domainOnlySslNotes = hasDomLine && !hasSslLine && sslNotesEffective.length > 0 && domainNotesEffective.length === 0;

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const nextSsl = sslNotes.trim();
      const nextDom = domainNotes.trim();
      await api.sites.update(site.id, {
        sslResolutionNotes: nextSsl || null,
        domainResolutionNotes: nextDom || null,
      });
      const fresh = (await api.sites.get(site.id)) as SiteRow;
      const sslInDb = fresh.sslResolutionNotes?.trim() ?? "";
      const domInDb = fresh.domainResolutionNotes?.trim() ?? "";
      const sslOk = notesMatchDb(nextSsl, fresh.sslResolutionNotes);
      const domOk = notesMatchDb(nextDom, fresh.domainResolutionNotes);

      if (!sslOk || !domOk) {
        setErr(
          "No se confirmó el guardado: ejecute la migración 006 (SQL Server) o reinicie el backend (SQLite) y vuelva a intentar."
        );
        setSslNotes(sslOk ? sslInDb : nextSsl);
        setDomainNotes(domOk ? domInDb : nextDom);
        return;
      }
      setSslNotes(sslInDb);
      setDomainNotes(domInDb);
      onSaved?.();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={title} onClose={onClose} wide>
      {loadingNotes && (
        <p className="muted small expiry-modal-loading" role="status">
          <Spinner size="sm" /> Cargando notas…
        </p>
      )}
      <p className="muted small" style={{ marginTop: 0 }}>
        <strong>{site.domain}</strong> ·{" "}
        <Link to={`/sites/${site.id}`}>Abrir ficha del sitio</Link>
      </p>
      <div className="stack expiry-modal-alerts" style={{ gap: "0.5rem", marginBottom: "1rem" }}>
        {row.lines.map((line) => (
          <div
            key={line.kind}
            className={line.urgency === "red" ? "expiry-detail--red" : "expiry-detail--yellow"}
          >
            {expiryLineText(line, site)}
          </div>
        ))}
      </div>
      <p className="muted small">
        Tras renovar, ejecute un chequeo en el sitio: la alerta desaparece cuando las fechas queden fuera de la ventana
        de aviso.
      </p>

      {showSslSection && (
        <section className="expiry-modal-section" aria-labelledby="expiry-ssl-heading">
          <h3 id="expiry-ssl-heading" className="modal-subtitle">
            {hasSslLine ? "SSL" : domainOnlySslNotes ? "Notas de resolución" : "Notas bajo certificado SSL"}
          </h3>
          {!hasSslLine && hasDomLine && !domainOnlySslNotes ? (
            <p className="muted small" style={{ marginTop: 0 }}>
              Estas notas están en la columna «Cómo resolver (renovar / instalar)» de la ficha del sitio. Si también
              aplica al dominio, use el campo de dominio más abajo o la sección Registro de dominio en la ficha.
            </p>
          ) : null}
          {domainOnlySslNotes ? (
            <p className="muted small" style={{ marginTop: 0 }}>
              Misma información que en la ficha (columna del certificado SSL). Para guardarla solo bajo «Registro de
              dominio», edite la ficha del sitio.
            </p>
          ) : null}
          {hasSslLine ? (
            <div className="resolution-readonly">
              <p className="muted small" style={{ marginTop: 0 }}>
                Datos del chequeo (solo lectura)
              </p>
              <dl className="dl compact">
                <dt>Estado</dt>
                <dd>
                  <Badge kind={site.sslStatus} variant="ssl" />
                </dd>
                <dt>Sujeto</dt>
                <dd>{site.sslSubject?.trim() || "—"}</dd>
                <dt>Emisor</dt>
                <dd>{site.sslIssuer?.trim() || "—"}</dd>
                <dt>Válido hasta</dt>
                <dd>
                  {site.sslValidTo ? new Date(site.sslValidTo).toLocaleString("es-ES", esDate) : "—"}
                </dd>
              </dl>
            </div>
          ) : null}
          <label className="modal-notes-label" style={{ marginTop: 0 }}>
            <span className="modal-notes-label-text">
              {hasSslLine
                ? "Cómo renovar o instalar el certificado"
                : domainOnlySslNotes
                  ? "Cómo resolver (pago / renovación / contacto)"
                  : "Texto guardado (misma ficha, columna SSL)"}
            </span>
            <textarea
              className="input expiry-followup-textarea expiry-modal-textarea"
              rows={4}
              placeholder="Contacto hosting, servidor, pasos…"
              value={sslNotes}
              onChange={(e) => setSslNotes(e.target.value)}
              disabled={loadingNotes}
            />
          </label>
        </section>
      )}

      {hasDomLine && (
        <section className="expiry-modal-section" aria-labelledby="expiry-dom-heading">
          <h3 id="expiry-dom-heading" className="modal-subtitle">
            Dominio
          </h3>
          <div className="resolution-readonly">
            <p className="muted small" style={{ marginTop: 0 }}>
              Datos del chequeo (solo lectura)
            </p>
            <dl className="dl compact">
              <dt>Registrador</dt>
              <dd>{site.registrarProvider?.trim() || "—"}</dd>
              <dt>Vence</dt>
              <dd>
                {site.domainExpiryFinal
                  ? new Date(site.domainExpiryFinal).toLocaleDateString("es-ES", { dateStyle: "long" })
                  : "—"}
              </dd>
            </dl>
          </div>
          {showDomainResolutionTextarea ? (
            <label className="modal-notes-label" style={{ marginTop: 0 }}>
              <span className="modal-notes-label-text">Cómo pagar o renovar el dominio</span>
              <textarea
                className="input expiry-followup-textarea expiry-modal-textarea"
                rows={4}
                placeholder="A quién pedir pago, cuenta GoDaddy, etc."
                value={domainNotes}
                onChange={(e) => setDomainNotes(e.target.value)}
                disabled={loadingNotes}
              />
            </label>
          ) : null}
        </section>
      )}

      <h3 className="modal-subtitle">Más contexto</h3>
      <div className="expiry-modal-context">
        <ExpiryContextBlock site={site} />
      </div>

      {err && <div className="card error" style={{ marginTop: "0.75rem" }}>{err}</div>}

      <p className="muted small expiry-modal-hint">
        Las notas se guardan en el servidor y en la ficha del sitio (sección Información).
      </p>

      <div className="modal-footer">
        <button type="button" className="btn" disabled={saving} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn primary expiry-modal-save"
          disabled={saving || loadingNotes}
          aria-busy={saving}
          onClick={() => void save()}
        >
          {saving ? (
            <>
              <Spinner size="sm" />
              Guardando…
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </Modal>
  );
}

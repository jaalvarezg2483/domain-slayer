import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { DocumentLinkPickerModal } from "../components/DocumentLinkPickerModal";
import { SiteActiveBadge } from "../components/SiteActiveBadge";
import { Spinner } from "../components/Spinner";
import { notesMatchDb } from "../lib/draft-after-save";
import { buildOperationalReport, labelCheckStatus, labelDomainExpiryStatus, labelHttpStatus } from "../lib/status-labels";
import type { SiteRow } from "../types";

const esDateTime: Intl.DateTimeFormatOptions = {
  dateStyle: "long",
  timeStyle: "short",
};

type SiteDetail = SiteRow &
  Record<string, unknown> & {
    sslResolutionNotes?: string | null;
    domainResolutionNotes?: string | null;
    linkedDocuments?: { id: string; title: string }[];
    domainExpirySource?: string | null;
    dnsStatus?: string;
    sslSubject?: string | null;
    sslIssuer?: string | null;
    sslSerialNumber?: string | null;
    domainExpiryStatus?: string;
    domainStatus?: string;
    checkStatus?: string;
    httpStatus?: string;
    httpsStatus?: string;
    sslHostnameMatch?: boolean | null;
    registrarProvider?: string | null;
  };

export function SiteDetail() {
  const { id } = useParams();
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [history, setHistory] = useState<{ items: unknown[] } | null>(null);
  const [docs, setDocs] = useState<unknown[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [docFormOpen, setDocFormOpen] = useState(false);
  const [docSaving, setDocSaving] = useState(false);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({
    title: "",
    documentType: "operational_notes",
    description: "",
    searchText: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState("operational_notes");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [sslResolutionDraft, setSslResolutionDraft] = useState("");
  const [domainResolutionDraft, setDomainResolutionDraft] = useState("");
  const [resolutionSaving, setResolutionSaving] = useState(false);
  const [resolutionErr, setResolutionErr] = useState<string | null>(null);
  const [resolutionSaveOk, setResolutionSaveOk] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const [s, h, d] = await Promise.all([
        api.sites.get(id),
        api.sites.history(id, { limit: 30 }),
        api.sites.documents(id),
      ]);
      setSite(s as SiteDetail);
      setHistory(h as { items: unknown[] });
      setDocs(d as unknown[]);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Solo al cambiar de sitio. Si dependemos de las notas del servidor, tras Guardar + load() el GET a veces
   *  llega sin esos campos y este efecto vaciaba los textareas antes de que aplicáramos la respuesta del PATCH. */
  useEffect(() => {
    if (!site?.id) return;
    setSslResolutionDraft(site.sslResolutionNotes ?? "");
    setDomainResolutionDraft(site.domainResolutionNotes ?? "");
  }, [site?.id]);

  const submitDocumentUpload = async () => {
    if (!id || !uploadFile) {
      setUploadErr("Seleccione un archivo (PDF, Word .docx, Excel, CSV o TXT).");
      return;
    }
    setUploadErr(null);
    setUploadNote(null);
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("siteId", id);
      fd.append("title", uploadTitle.trim() || uploadFile.name);
      fd.append("documentType", uploadDocType);
      if (uploadDesc.trim()) fd.append("description", uploadDesc.trim());
      const r = await api.documents.upload(fd);
      setUploadNote(typeof r.extractionNote === "string" ? r.extractionNote : null);
      setUploadFile(null);
      setUploadTitle("");
      setUploadDesc("");
      const input = document.getElementById("site-doc-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await load();
    } catch (e) {
      setUploadErr((e as Error).message);
    } finally {
      setUploadBusy(false);
    }
  };

  const submitDocument = async () => {
    if (!id) return;
    const title = docForm.title.trim();
    if (!title) {
      setDocErr("Indique un título para el documento.");
      return;
    }
    setDocErr(null);
    setDocSaving(true);
    try {
      await api.documents.create({
        siteId: id,
        title,
        documentType: docForm.documentType,
        description: docForm.description.trim() || null,
        searchText: docForm.searchText.trim() || null,
      });
      setDocForm({ title: "", documentType: "operational_notes", description: "", searchText: "" });
      setDocFormOpen(false);
      await load();
    } catch (e) {
      setDocErr((e as Error).message);
    } finally {
      setDocSaving(false);
    }
  };

  const runCheck = async () => {
    if (!id || checking) return;
    setCheckErr(null);
    setChecking(true);
    try {
      await api.monitoring.checkOne(id);
      await load();
    } catch (e) {
      setCheckErr((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const saveResolutionNotes = async () => {
    if (!id) return;
    setResolutionErr(null);
    setResolutionSaveOk(false);
    setResolutionSaving(true);
    try {
      const nextSsl = sslResolutionDraft.trim();
      const nextDom = domainResolutionDraft.trim();
      await api.sites.update(id, {
        sslResolutionNotes: nextSsl || null,
        domainResolutionNotes: nextDom || null,
      });
      const fresh = (await api.sites.get(id)) as SiteDetail;
      const sslInDb = fresh.sslResolutionNotes?.trim() ?? "";
      const domInDb = fresh.domainResolutionNotes?.trim() ?? "";
      const sslOk = notesMatchDb(nextSsl, fresh.sslResolutionNotes);
      const domOk = notesMatchDb(nextDom, fresh.domainResolutionNotes);

      setSslResolutionDraft(sslOk ? sslInDb : nextSsl);
      setDomainResolutionDraft(domOk ? domInDb : nextDom);
      setSite({
        ...fresh,
        sslResolutionNotes: sslOk ? fresh.sslResolutionNotes ?? null : nextSsl || null,
        domainResolutionNotes: domOk ? fresh.domainResolutionNotes ?? null : nextDom || null,
      });

      if (!sslOk || !domOk) {
        setResolutionErr(
          "Las notas no se guardaron: faltan columnas en la base de datos o el backend no las creó al arrancar. " +
            "SQL Server: ejecute database/migrations/006_site_resolution_notes_and_doc_links.sql. " +
            "SQLite con DB_SYNC=false: reinicie el backend para aplicar el esquema. Luego reinicie el API y vuelva a guardar."
        );
        return;
      }
      setResolutionSaveOk(true);
      window.setTimeout(() => setResolutionSaveOk(false), 5000);
    } catch (e) {
      setResolutionErr((e as Error).message);
    } finally {
      setResolutionSaving(false);
    }
  };

  const removeDocumentLink = async (documentId: string) => {
    if (!id) return;
    setResolutionErr(null);
    try {
      await api.sites.removeDocumentLink(id, documentId);
      await load();
    } catch (e) {
      setResolutionErr((e as Error).message);
    }
  };

  if (err) return <div className="card error">{err}</div>;
  if (!site) return <div className="muted">Cargando…</div>;

  const report = buildOperationalReport(site);

  const DAY_MS = 86_400_000;
  const sslManualDisagreesWithTls =
    site.sslExpirySource === "manual" &&
    site.sslValidTo &&
    site.sslValidToFinal &&
    Math.abs(new Date(site.sslValidTo).getTime() - new Date(site.sslValidToFinal).getTime()) > DAY_MS;

  return (
    <div className="stack" aria-busy={checking}>
      {checking && (
        <div className="loading-banner" role="status">
          <Spinner size="md" />
          <span>Revisando sitio (SSL, DNS, HTTP…) — puede tardar varios segundos.</span>
        </div>
      )}
      {checkErr && <div className="card error">{checkErr}</div>}
      <div className="row-between">
        <div>
          <Link to="/sites" className="muted small">
            ← Sitios
          </Link>
          <h1>{site.siteName}</h1>
          <p className="muted">{site.domain}</p>
        </div>
        <div className="row gap">
          <Link className="btn" to={`/sites/${id}/edit`} title="Incluye fecha de expiración del dominio si WHOIS no la trae">
            Editar sitio
          </Link>
          <button
            type="button"
            className="btn primary"
            disabled={checking}
            aria-busy={checking}
            onClick={() => void runCheck()}
          >
            {checking ? (
              <>
                <Spinner size="sm" />
                Revisando…
              </>
            ) : (
              "Ejecutar chequeo"
            )}
          </button>
        </div>
      </div>

      <div className="grid stats site-detail-stats">
        <div className="card stat">
          <div className="stat-label">Estado</div>
          <SiteActiveBadge isActive={site.isActive !== false} />
        </div>
        <div className="card stat">
          <div className="stat-label">Salud</div>
          <Badge kind={site.healthStatus} variant="health" />
        </div>
        <div className="card stat">
          <div className="stat-label">SSL</div>
          <Badge kind={site.sslStatus} variant="ssl" />
        </div>
        <div className="card stat">
          <div className="stat-label">DNS</div>
          <Badge kind={site.dnsStatus ?? "unknown"} variant="dns" />
        </div>
      </div>

      <div className="card">
        <h2>Notas del sitio</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Aquí puede documentar URLs (producción, desarrollo, staging), rutas de administración y credenciales que use el
          equipo. Trate esta información como sensible.
        </p>
        {site.notes?.trim() ? (
          <div className="site-notes-body">{site.notes}</div>
        ) : (
          <p className="muted" style={{ marginBottom: 0 }}>
            Sin notas. Use «Editar sitio» para añadirlas.
          </p>
        )}
      </div>

      <div className="card site-expiry-solution">
        <h2>Información</h2>

        <h3 className="resolution-section-title">Certificado SSL</h3>
        {sslManualDisagreesWithTls ? (
          <div
            role="status"
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: 6,
              border: "1px solid var(--warn)",
              background: "rgba(255, 159, 10, 0.1)",
            }}
          >
            <strong>La fecha que usa el sistema no coincide con el último chequeo TLS</strong>
            <p className="muted small" style={{ margin: "0.5rem 0 0 0" }}>
              Origen: <strong>manual</strong>. El panel muestra{" "}
              <strong>{new Date(site.sslValidToFinal as string).toLocaleString("es-ES", esDateTime)}</strong> como fin de
              validez, pero el chequeo obtuvo{" "}
              <strong>{new Date(site.sslValidTo as string).toLocaleString("es-ES", esDateTime)}</strong> (alineado con lo que
              suele ver el navegador). Para confiar en el certificado real, abra «Editar sitio» y elimine o corrija la fecha SSL
              manual, o deje que prevalezca la detección automática tras un chequeo correcto.
            </p>
          </div>
        ) : null}
        <div className="resolution-split">
          <div className="resolution-readonly">
            <p className="muted small" style={{ marginTop: 0 }}>
              Datos del chequeo
            </p>
            <dl className="dl compact">
              <dt>Estado</dt>
              <dd>
                <Badge kind={site.sslStatus} variant="ssl" />
              </dd>
              <dt>Sujeto</dt>
              <dd>{site.sslSubject ?? "—"}</dd>
              <dt>Emisor</dt>
              <dd>{site.sslIssuer ?? "—"}</dd>
              <dt>Válido hasta (chequeo TLS)</dt>
              <dd>
                {site.sslValidTo ? new Date(site.sslValidTo).toLocaleString("es-ES", esDateTime) : "—"}
              </dd>
              <dt>Fecha usada por el sistema</dt>
              <dd>
                {site.sslValidToFinal
                  ? new Date(site.sslValidToFinal).toLocaleString("es-ES", esDateTime)
                  : "—"}
              </dd>
              <dt>Origen fecha SSL</dt>
              <dd>
                {site.sslExpirySource === "manual"
                  ? "Manual (editada en «Editar sitio»)"
                  : site.sslExpirySource === "auto"
                    ? "Automática (chequeo TLS)"
                    : site.sslExpirySource === "unavailable"
                      ? "Sin detección automática"
                      : "—"}
              </dd>
              <dt>Número de serie</dt>
              <dd>{site.sslSerialNumber?.trim() || "—"}</dd>
            </dl>
          </div>
          <div className="resolution-edit">
            <label className="modal-notes-label">
              <span className="modal-notes-label-text">Cómo resolver (renovar / instalar)</span>
              <textarea
                className="input expiry-followup-textarea"
                rows={6}
                placeholder="Contacto hosting, servidor, pasos para instalar o renovar el certificado…"
                value={sslResolutionDraft}
                onChange={(e) => setSslResolutionDraft(e.target.value)}
              />
            </label>
          </div>
        </div>

        <h3 className="resolution-section-title">Registro de dominio</h3>
        <div className="resolution-split">
          <div className="resolution-readonly">
            <p className="muted small" style={{ marginTop: 0 }}>
              Datos del chequeo
            </p>
            <dl className="dl compact">
              <dt>Registrador</dt>
              <dd>{site.registrarProvider?.trim() || "—"}</dd>
              <dt>Fecha fin</dt>
              <dd>
                {site.domainExpiryFinal
                  ? new Date(site.domainExpiryFinal).toLocaleDateString("es-ES", { dateStyle: "long" })
                  : "—"}
              </dd>
              <dt>Expiración</dt>
              <dd>{labelDomainExpiryStatus(String(site.domainExpiryStatus ?? "unknown"))}</dd>
              <dt>Origen de la fecha</dt>
              <dd>
                {site.domainExpirySource === "manual"
                  ? "Manual (editada en «Editar sitio»)"
                  : site.domainExpirySource === "auto"
                    ? "Automática (RDAP/WHOIS)"
                    : site.domainExpirySource === "unavailable"
                      ? "Sin detección automática"
                      : "—"}
              </dd>
            </dl>
          </div>
          <div className="resolution-edit">
            <label className="modal-notes-label">
              <span className="modal-notes-label-text">Cómo resolver (pago / renovación)</span>
              <textarea
                className="input expiry-followup-textarea"
                rows={6}
                placeholder="A quién solicitar el pago (p. ej. jefe en GoDaddy), proveedor, procedimiento…"
                value={domainResolutionDraft}
                onChange={(e) => setDomainResolutionDraft(e.target.value)}
              />
            </label>
          </div>
        </div>

        <h3 className="resolution-section-title">Conectividad</h3>
        <div className="resolution-split">
          <div className="resolution-readonly">
            <p className="muted small" style={{ marginTop: 0 }}>
              Datos del chequeo
            </p>
            <dl className="dl compact">
              <dt>Estado del chequeo</dt>
              <dd>{labelCheckStatus(String(site.checkStatus ?? "unknown"))}</dd>
              <dt>HTTP</dt>
              <dd>{labelHttpStatus(String(site.httpStatus ?? "unknown"))}</dd>
              <dt>HTTPS</dt>
              <dd>{labelHttpStatus(String(site.httpsStatus ?? "unknown"))}</dd>
            </dl>
          </div>
          <div className="resolution-edit resolution-edit--hint">
            <p className="muted small" style={{ margin: 0 }}>
              Si HTTP o HTTPS muestran error, revise firewall, DNS o que el servicio web esté activo; no es un campo
              editable aquí.
            </p>
          </div>
        </div>

        {resolutionErr && <div className="card error" style={{ marginTop: "0.75rem" }}>{resolutionErr}</div>}
        <div className="row gap" style={{ marginTop: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="btn primary resolution-save-btn"
            disabled={resolutionSaving}
            aria-busy={resolutionSaving}
            onClick={() => void saveResolutionNotes()}
          >
            {resolutionSaving ? (
              <>
                <Spinner size="sm" />
                Guardando…
              </>
            ) : (
              "Guardar notas de resolución"
            )}
          </button>
          {resolutionSaveOk && (
            <span className="resolution-saved-feedback" role="status">
              Guardado correctamente.
            </span>
          )}
        </div>

        <hr className="resolution-hr" />

        <h3 className="resolution-section-title">Manuales y documentos (biblioteca)</h3>
        <p className="muted small">
          Enlace un documento de la <Link to="/library">Biblioteca</Link> para abrir el manual o procedimiento desde
          este sitio. Un mismo documento puede enlazarse a varios sitios (p. ej. un manual común de renovación SSL).
        </p>
        {(site.linkedDocuments?.length ?? 0) === 0 ? (
          <p className="muted">Ningún documento enlazado.</p>
        ) : (
          <ul className="list linked-doc-list">
            {(site.linkedDocuments ?? []).map((d) => (
              <li key={d.id} className="linked-doc-row">
                <Link to="/library">{d.title}</Link>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => void removeDocumentLink(d.id)}
                >
                  Quitar enlace
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn" onClick={() => setDocPickerOpen(true)}>
          Enlazar documento…
        </button>
        <DocumentLinkPickerModal
          open={docPickerOpen}
          siteId={site.id}
          linkedIds={new Set((site.linkedDocuments ?? []).map((d) => d.id))}
          onClose={() => setDocPickerOpen(false)}
          onLinked={() => void load()}
        />
      </div>

      <div className="card">
        <h2>Informe operativo</h2>
        <p className="muted small">
          Último chequeo:{" "}
          {site.lastCheckedAt ? new Date(site.lastCheckedAt).toLocaleString("es-ES", esDateTime) : "—"}
        </p>
        <ul className="report-list">
          {report.map((line, i) => (
            <li key={i} className={`report-line report-${line.level}`}>
              {line.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <div className="row-between">
          <h2>Documentación</h2>
          <button type="button" className="btn small" onClick={() => setDocFormOpen((o) => !o)}>
            {docFormOpen ? "Cerrar formulario" : "Añadir documento"}
          </button>
        </div>
        <p className="muted small">
          Puede <strong>subir archivos</strong> (PDF, Word .docx, Excel .xlsx/.xls, CSV o TXT): el sistema extrae el
          texto y lo indexa para la{" "}
          <Link to="/library">Biblioteca</Link>. También puede pegar datos manualmente en{" "}
          <strong>texto para búsqueda</strong> abajo.
        </p>

        <div
          className="stack"
          style={{
            marginTop: "1rem",
            padding: "1rem",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "rgba(61, 139, 253, 0.06)",
          }}
        >
          <h3>Subir documento desde archivo</h3>
          <p className="muted small">
            Word antiguo <code>.doc</code> no está soportado; use .docx o PDF. Los PDF escaneados sin OCR pueden no
            devolver texto.
          </p>
          {uploadErr && <div className="card error">{uploadErr}</div>}
          {uploadNote && (
            <p className="muted small" role="status">
              Aviso de extracción: {uploadNote}
            </p>
          )}
          <div className="form-grid">
            <label className="span-2">
              Archivo
              <input
                id="site-doc-file"
                className="input"
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => {
                  setUploadErr(null);
                  setUploadNote(null);
                  setUploadFile(e.target.files?.[0] ?? null);
                }}
              />
            </label>
            <label>
              Título
              <input
                className="input"
                placeholder="Por defecto: nombre del archivo"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </label>
            <label>
              Tipo
              <select
                className="input"
                value={uploadDocType}
                onChange={(e) => setUploadDocType(e.target.value)}
              >
                <option value="operational_notes">Notas operativas</option>
                <option value="technical_manual">Manual técnico</option>
                <option value="provider_data">Datos de proveedor</option>
                <option value="dns_data">DNS</option>
                <option value="contacts">Contactos</option>
                <option value="observations">Observaciones</option>
                <option value="certificate">Certificado</option>
                <option value="payment_info">Pagos</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label className="span-2">
              Descripción (opcional)
              <textarea
                className="input"
                rows={2}
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
              />
            </label>
            <div className="span-2">
              <button
                type="button"
                className="btn primary"
                disabled={uploadBusy || !uploadFile}
                aria-busy={uploadBusy}
                onClick={() => void submitDocumentUpload()}
              >
                {uploadBusy ? (
                  <>
                    <Spinner size="sm" /> Subiendo e indexando…
                  </>
                ) : (
                  "Subir e indexar"
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="muted small" style={{ marginTop: "1rem" }}>
          O bien cree un documento solo con texto: use <strong>texto para búsqueda</strong> para pegar tablas o notas.
        </p>
        {docFormOpen && (
          <div className="form-grid" style={{ marginTop: "1rem" }}>
            {docErr && <div className="card error span-2">{docErr}</div>}
            <label>
              Título
              <input
                className="input"
                value={docForm.title}
                onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label>
              Tipo
              <select
                className="input"
                value={docForm.documentType}
                onChange={(e) => setDocForm((f) => ({ ...f, documentType: e.target.value }))}
              >
                <option value="operational_notes">Notas operativas</option>
                <option value="technical_manual">Manual técnico</option>
                <option value="provider_data">Datos de proveedor</option>
                <option value="dns_data">DNS</option>
                <option value="contacts">Contactos</option>
                <option value="observations">Observaciones</option>
                <option value="certificate">Certificado</option>
                <option value="payment_info">Pagos</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label className="span-2">
              Descripción
              <textarea
                className="input"
                rows={2}
                value={docForm.description}
                onChange={(e) => setDocForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="span-2">
              Texto para búsqueda (opcional)
              <textarea
                className="input"
                rows={6}
                placeholder="Pegue aquí filas de Excel, contraseñas de BD de prueba, URLs de staging, etc."
                value={docForm.searchText}
                onChange={(e) => setDocForm((f) => ({ ...f, searchText: e.target.value }))}
              />
            </label>
            <div className="span-2">
              <button
                type="button"
                className="btn primary"
                disabled={docSaving}
                aria-busy={docSaving}
                onClick={() => void submitDocument()}
              >
                {docSaving ? (
                  <>
                    <Spinner size="sm" /> Guardando…
                  </>
                ) : (
                  "Guardar documento"
                )}
              </button>
            </div>
          </div>
        )}
        {docs.length === 0 ? (
          <p className="muted">Sin documentos registrados.</p>
        ) : (
          <ul className="list">
            {docs.map((d) => {
              const row = d as { id: string; title: string; searchText?: string | null };
              return (
                <li key={row.id}>
                  <strong>{row.title}</strong>
                  {row.searchText ? <span className="muted small"> — con texto indexable</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Historial de revisiones</h2>
        {!history?.items?.length ? (
          <p className="muted">Sin historial aún.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>SSL</th>
                <th>Dominio</th>
                <th>Duración</th>
              </tr>
            </thead>
            <tbody>
              {(history.items as Record<string, string>[]).map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.checkedAt).toLocaleString("es-ES", esDateTime)}</td>
                  <td>
                    <Badge kind={h.sslStatus} variant="ssl" />
                  </td>
                  <td>
                    <Badge kind={h.domainStatus} variant="domain" />
                  </td>
                  <td>{h.durationMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

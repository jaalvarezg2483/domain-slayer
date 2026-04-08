import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthMode } from "../auth-context";
import { api, type DocumentEmbeddedMediaItem } from "../api";
import { ConfirmModal } from "../components/ConfirmModal";
import { DocumentTextWithEmbeddings } from "../components/DocumentTextWithEmbeddings";
import { Spinner } from "../components/Spinner";
import { isAdminSession } from "../lib/auth-session";
import type { SiteRow } from "../types";

type Hit = {
  document: {
    id: string;
    siteId: string | null;
    title: string;
    documentType: string;
    description: string | null;
    searchText: string | null;
    embeddedMedia?: DocumentEmbeddedMediaItem[] | null;
  };
  siteName: string;
  domain: string;
  snippet: string | null;
};

const DOC_TYPES: { value: string; label: string }[] = [
  ["operational_notes", "Notas operativas"],
  ["technical_manual", "Manual técnico"],
  ["provider_data", "Datos de proveedor"],
  ["dns_data", "DNS"],
  ["contacts", "Contactos"],
  ["observations", "Observaciones"],
  ["certificate", "Certificado"],
  ["payment_info", "Pagos"],
  ["other", "Otro"],
].map(([value, label]) => ({ value, label }));

const DOC_TYPE_LABEL = new Map(DOC_TYPES.map((d) => [d.value, d.label]));

function formatFileSize(n: number | null): string {
  if (n == null || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** UTF-8 leído como Latin-1 al indexar (p. ej. «DocumentaciÃ³n»). */
function displayFileName(name: string | null | undefined): string {
  if (name == null || name === "") return "—";
  if (!/Ã|Â/.test(name)) return name;
  try {
    const bytes = new Uint8Array(name.length);
    for (let i = 0; i < name.length; i++) bytes[i] = name.charCodeAt(i) & 0xff;
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return name;
  }
}

type LibraryDocRow = {
  id: string;
  siteId: string | null;
  siteName: string | null;
  documentType: string;
  title: string;
  description: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: string;
};

export function Library() {
  const { authRequired } = useAuthMode();
  const isAdmin = !authRequired || isAdminSession();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [sitesErr, setSitesErr] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [items, setItems] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");

  const [uploadSiteId, setUploadSiteId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState("operational_notes");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState<string | null>(null);

  const [libDocs, setLibDocs] = useState<LibraryDocRow[]>([]);
  const [libTotal, setLibTotal] = useState(0);
  const [libLoading, setLibLoading] = useState(false);
  const [libErr, setLibErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [docPendingDelete, setDocPendingDelete] = useState<LibraryDocRow | null>(null);

  const loadLibraryList = () => {
    setLibLoading(true);
    setLibErr(null);
    return api.documents
      .list({ limit: 500, offset: 0 })
      .then((r) => {
        setLibDocs((r.items ?? []) as LibraryDocRow[]);
        setLibTotal(r.total ?? 0);
      })
      .catch((e: Error) => setLibErr(e.message))
      .finally(() => setLibLoading(false));
  };

  useEffect(() => {
    void loadLibraryList();
  }, []);

  useEffect(() => {
    api.sites
      .list({ limit: "500", offset: "0" })
      .then((r) => {
        const list = (r.items ?? []) as SiteRow[];
        setSites(list.filter((s) => s.isActive !== false));
        setSitesErr(null);
      })
      .catch((e: Error) => setSitesErr(e.message));
  }, []);

  const search = async () => {
    const q = query.trim();
    setLoading(true);
    setErr(null);
    try {
      const r = await api.documents.search(q, { match: matchMode });
      setItems(r.items as Hit[]);
      setTotal(r.total);
      setLastQuery(q);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitUpload = async () => {
    setUploadErr(null);
    setUploadNote(null);
    setUploadOk(null);
    if (!uploadFile) {
      setUploadErr("Seleccione un archivo (PDF, Word .docx, Excel, CSV o TXT).");
      return;
    }
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      if (uploadSiteId.trim()) fd.append("siteId", uploadSiteId.trim());
      fd.append("title", uploadTitle.trim() || uploadFile.name);
      fd.append("documentType", uploadDocType);
      if (uploadDesc.trim()) fd.append("description", uploadDesc.trim());
      const r = await api.documents.upload(fd);
      const note = typeof r.extractionNote === "string" ? r.extractionNote : null;
      setUploadNote(note);
      setUploadOk("Documento guardado e indexado. Ya puede buscarlo con palabras clave abajo.");
      setUploadFile(null);
      setUploadTitle("");
      setUploadDesc("");
      void loadLibraryList();
      const input = document.getElementById("library-doc-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (e) {
      setUploadErr((e as Error).message);
    } finally {
      setUploadBusy(false);
    }
  };

  const downloadDocument = async (d: LibraryDocRow) => {
    setLibErr(null);
    setDownloadingId(d.id);
    try {
      const safeTitle = d.title.replace(/[/\\?%*:|"<>]/g, "_").trim() || "documento";
      const fallback = displayFileName(d.fileName) || `${safeTitle}.bin`;
      await api.documents.downloadFile(d.id, fallback);
    } catch (e) {
      setLibErr((e as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const executeDeleteDocument = () => {
    const row = docPendingDelete;
    if (!row) return;
    setDeletingId(row.id);
    setLibErr(null);
    api.documents
      .remove(row.id)
      .then(() => {
        setDocPendingDelete(null);
        void loadLibraryList();
        setItems((prev) => prev.filter((h) => h.document.id !== row.id));
      })
      .catch((e: Error) => setLibErr(e.message))
      .finally(() => setDeletingId(null));
  };

  return (
    <div className="stack">
      <h1>Biblioteca y búsqueda</h1>
      {isAdmin ? (
        <p className="muted">
          <strong>Primero</strong> suba el archivo. Puede dejarlo <strong>sin sitio</strong> si el Excel o PDF aplica a
          varios sistemas (credenciales compartidas, listados, etc.). Opcionalmente vincule un sitio.{" "}
          <strong>Después</strong> busque por palabras clave (deben aparecer <em>todas</em>).
        </p>
      ) : (
        <p className="muted">
          Busque por palabras clave abajo y descargue los archivos que necesite. Solo los administradores pueden subir o
          eliminar documentos.
        </p>
      )}

      {isAdmin ? (
      <div
        className="card"
        style={{
          borderColor: "var(--accent)",
          boxShadow: "0 0 0 1px rgba(61, 139, 253, 0.25)",
        }}
      >
        <h2 style={{ fontSize: "1.2rem", marginTop: 0 }}>Añadir documentación a la biblioteca</h2>
        <p className="muted small">
          Formatos: PDF, Word <code>.docx</code>, Excel <code>.xlsx</code>/<code>.xls</code>, CSV o TXT (máx. 35 MB). El
          texto se extrae y se usa para la búsqueda. Word antiguo <code>.doc</code> no está soportado. Use{" "}
          <strong>sin sitio</strong> para hojas con datos de múltiples aplicaciones.
        </p>
        {sitesErr && <div className="card error">{sitesErr}</div>}
        {uploadErr && <div className="card error">{uploadErr}</div>}
        {uploadOk && (
          <p className="muted small" role="status" style={{ color: "var(--ok)" }}>
            {uploadOk}
          </p>
        )}
        {uploadNote && (
          <p className="muted small" role="status">
            Nota de extracción: {uploadNote}
          </p>
        )}

        <div className="form-grid" style={{ marginTop: "0.75rem" }}>
          <label className="span-2">
            <span className="muted small">Sitio (opcional)</span>
            <select
              className="input"
              value={uploadSiteId}
              onChange={(e) => {
                setUploadSiteId(e.target.value);
                setUploadErr(null);
              }}
              aria-label="Sitio"
            >
              <option value="">Sin sitio (documento global o compartido)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteName} ({s.domain})
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            <span className="muted small">Archivo</span>
            <input
              id="library-doc-file"
              className="input"
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => {
                setUploadFile(e.target.files?.[0] ?? null);
                setUploadErr(null);
                setUploadOk(null);
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
            <select className="input" value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)}>
              {DOC_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Descripción (opcional)
            <textarea className="input" rows={2} value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} />
          </label>
          <div className="span-2 row gap">
            <button
              type="button"
              className="btn primary"
              disabled={uploadBusy || !uploadFile}
              aria-busy={uploadBusy}
              onClick={() => void submitUpload()}
            >
              {uploadBusy ? (
                <>
                  <Spinner size="sm" /> Subiendo e indexando…
                </>
              ) : (
                "Subir e indexar"
              )}
            </button>
            <Link className="btn ghost" to="/sites/new">
              Nuevo sitio
            </Link>
          </div>
        </div>
      </div>
      ) : null}

      <div className="card">
        <div className="row-between wrap gap" style={{ marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>Documentos en la biblioteca</h2>
          <button type="button" className="btn small ghost" disabled={libLoading} onClick={() => void loadLibraryList()}>
            {libLoading ? (
              <>
                <Spinner size="sm" /> Actualizando…
              </>
            ) : (
              "Actualizar listado"
            )}
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Use <strong>Descargar</strong> para guardar el archivo original en su equipo.
          {isAdmin ? (
            <>
              {" "}
              Revise versiones y elimine los que estén desactualizados; la búsqueda y el asistente dejarán de usarlos de
              inmediato.
            </>
          ) : null}
        </p>
        {libErr && <div className="card error" style={{ marginTop: "0.5rem" }}>{libErr}</div>}
        {!libLoading && libDocs.length === 0 && !libErr && (
          <p className="muted small">No hay documentos. Suba uno arriba.</p>
        )}
        {libDocs.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Archivo</th>
                  <th>Tipo</th>
                  <th>Sitio</th>
                  <th>Tamaño</th>
                  <th>Alta</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {libDocs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.title}</strong>
                      {d.description ? (
                        <div className="muted small" style={{ marginTop: "0.2rem", maxWidth: "22rem" }}>
                          {d.description.length > 120 ? `${d.description.slice(0, 120)}…` : d.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="muted small">{displayFileName(d.fileName)}</td>
                    <td className="muted small">{DOC_TYPE_LABEL.get(d.documentType) ?? d.documentType}</td>
                    <td className="muted small">
                      {d.siteId ? (
                        <>
                          {d.siteName ?? "—"}{" "}
                          <Link className="muted small" to={`/sites/${d.siteId}`} style={{ marginLeft: "0.25rem" }}>
                            Ver sitio
                          </Link>
                        </>
                      ) : (
                        "Biblioteca global"
                      )}
                    </td>
                    <td className="muted small">{formatFileSize(d.fileSizeBytes)}</td>
                    <td className="muted small">
                      {d.createdAt
                        ? new Date(d.createdAt).toLocaleString("es-ES", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td>
                      <div className="row gap wrap" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn small ghost"
                          disabled={downloadingId === d.id || deletingId === d.id}
                          onClick={() => void downloadDocument(d)}
                        >
                          {downloadingId === d.id ? "…" : "Descargar"}
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="btn small danger"
                            disabled={deletingId === d.id || downloadingId === d.id}
                            onClick={() => setDocPendingDelete(d)}
                          >
                            {deletingId === d.id ? "…" : "Eliminar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {libTotal > libDocs.length && (
          <p className="muted small" style={{ marginTop: "0.5rem" }}>
            Mostrando {libDocs.length} de {libTotal}. Aumente el límite en el API si necesita ver más.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: "1.2rem", marginTop: 0 }}>Buscar en la biblioteca</h2>
        <div className="library-search-toolbar">
          <label className="library-search-toolbar__keywords">
            <span className="muted small">Palabras clave</span>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
              placeholder="ej. avalúo ipurdy toyota (sin acentos también funciona)"
              aria-label="Palabras clave"
            />
          </label>
          <div className="library-search-toolbar__controls">
            <label className="library-search-toolbar__match muted small">
              <span>Coincidencia</span>
              <select
                className="input"
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value as "any" | "all")}
                aria-label="Modo de coincidencia"
              >
                <option value="any">Cualquier palabra</option>
                <option value="all">Todas las palabras</option>
              </select>
            </label>
            <button
              type="button"
              className="btn primary library-search-toolbar__submit"
              disabled={loading}
              aria-busy={loading}
              onClick={() => void search()}
            >
              {loading ? (
                <>
                  <Spinner size="sm" /> Buscando…
                </>
              ) : (
                "Buscar"
              )}
            </button>
          </div>
        </div>
        <p className="muted small library-search-toolbar__hint">
          La búsqueda ignora mayúsculas y tildes. Los resultados muestran fragmentos del texto indexado. Para un resumen
          redactado use <Link to="/assistant">Búsqueda inteligente</Link> (inventario + documentos).
        </p>
        {lastQuery && (
          <p className="muted small" style={{ marginTop: "0.75rem" }}>
            {total === 0
              ? `Sin resultados para «${lastQuery}».`
              : `${total} resultado(s) para «${lastQuery}».`}
          </p>
        )}
      </div>

      {err && <div className="card error">{err}</div>}

      {items.length > 0 && (
        <div className="stack gap">
          {items.map((h) => (
            <article key={h.document.id} className="card">
              <div className="row-between wrap">
                <div>
                  <h3>{h.document.title}</h3>
                  <p className="muted small">
                    {h.siteName} · {h.domain}
                  </p>
                </div>
                {h.document.siteId ? (
                  <Link className="btn small" to={`/sites/${h.document.siteId}`}>
                    Ver sitio
                  </Link>
                ) : (
                  <span className="muted small">Documento global</span>
                )}
              </div>
              {h.snippet && (
                <blockquote className="search-snippet">
                  {(h.document.embeddedMedia?.length ?? 0) > 0 && /\[imagen\s+\d+\]/i.test(h.snippet) ? (
                    <DocumentTextWithEmbeddings
                      documentId={h.document.id}
                      text={h.snippet}
                      embeddedMedia={h.document.embeddedMedia}
                    />
                  ) : (
                    h.snippet
                  )}
                </blockquote>
              )}
              <p className="muted small">Tipo: {h.document.documentType}</p>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={docPendingDelete !== null}
        title="Eliminar documento"
        message={
          docPendingDelete ? (
            <>
              ¿Eliminar <strong>«{docPendingDelete.title}»</strong> de la biblioteca?
              <br />
              <br />
              Se borrará el índice y el archivo en el servidor. Los enlaces desde sitios dejarán de mostrarlo.
            </>
          ) : null
        }
        tone="danger"
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        busy={deletingId !== null && docPendingDelete !== null && deletingId === docPendingDelete.id}
        busyLabel="Eliminando…"
        onCancel={() => {
          if (!deletingId) setDocPendingDelete(null);
        }}
        onConfirm={() => void executeDeleteDocument()}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

type Hit = {
  document: { id: string; title: string; documentType: string };
  siteName: string;
  domain: string;
};

type Props = {
  open: boolean;
  siteId: string;
  linkedIds: Set<string>;
  onClose: () => void;
  onLinked: () => void;
};

export function DocumentLinkPickerModal({ open, siteId, linkedIds, onClose, onLinked }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Hit[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setItems([]);
    setQ("");
  }, [open]);

  const search = async () => {
    const query = q.trim();
    if (query.length < 2) {
      setErr("Escriba al menos 2 caracteres.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await api.documents.search(query, { limit: 25, match: "any" });
      setItems(r.items as Hit[]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const link = async (documentId: string) => {
    setLinking(documentId);
    setErr(null);
    try {
      await api.sites.addDocumentLink(siteId, documentId);
      onLinked();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLinking(null);
    }
  };

  return (
    <Modal open={open} title="Enlazar documento de la biblioteca" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Busque por título o contenido indexado. El mismo documento puede estar enlazado en varios sitios.
      </p>
      <div className="row gap" style={{ flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <input
          className="input"
          style={{ flex: "1 1 12rem" }}
          placeholder="Ej.: manual SSL, GoDaddy…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        />
        <button type="button" className="btn primary" disabled={loading} onClick={() => void search()}>
          {loading ? <Spinner size="sm" /> : "Buscar"}
        </button>
      </div>
      {err && <div className="card error" style={{ marginBottom: "0.75rem" }}>{err}</div>}
      <ul className="list document-picker-list">
        {items.map((h) => {
          const id = h.document.id;
          const already = linkedIds.has(id);
          return (
            <li key={id}>
              <div>
                <strong>{h.document.title}</strong>
                <div className="muted small">
                  {h.document.documentType} · {h.siteName} ({h.domain})
                </div>
              </div>
              <button
                type="button"
                className="btn small primary"
                disabled={already || linking === id}
                onClick={() => void link(id)}
              >
                {already ? "Ya enlazado" : linking === id ? "…" : "Enlazar"}
              </button>
            </li>
          );
        })}
      </ul>
      {items.length === 0 && !loading && q.trim().length >= 2 && !err && (
        <p className="muted small">Sin resultados. Pruebe otras palabras o suba el documento en la{" "}
          <Link to="/library">Biblioteca</Link>.</p>
      )}
    </Modal>
  );
}

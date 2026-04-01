import { Fragment, useEffect, useState, type ReactNode } from "react";
import { apiBase, authHeaders, type DocumentEmbeddedMediaItem } from "../api";

function documentEmbeddedMediaUrl(documentId: string, fileName: string): string {
  const base = apiBase();
  return `${base}/documents/${encodeURIComponent(documentId)}/embedded-media/${encodeURIComponent(fileName)}`;
}

function AuthedDocImage({ documentId, fileName }: { documentId: string; fileName: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urlRef: { current: string | null } = { current: null };
    setSrc(null);
    setErr(false);
    void (async () => {
      try {
        const res = await fetch(documentEmbeddedMediaUrl(documentId, fileName), {
          headers: authHeaders(),
        });
        if (!res.ok || cancelled) {
          if (!cancelled) setErr(true);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        urlRef.current = u;
        setSrc(u);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [documentId, fileName]);

  if (err) {
    return <span className="muted small">[No se pudo cargar la imagen]</span>;
  }
  if (!src) {
    return <span className="muted small">Cargando imagen…</span>;
  }
  return (
    <figure className="library-embedded-figure">
      <img src={src} alt="" className="library-embedded-img" />
    </figure>
  );
}

const IMAGEN_TAG = /\[Imagen\s+(\d+)\]/gi;

/**
 * Texto con marcadores `[Imagen N]` (Word) más figuras servidas con JWT.
 */
export function DocumentTextWithEmbeddings({
  documentId,
  text,
  embeddedMedia,
  className,
}: {
  documentId: string;
  text: string;
  embeddedMedia: DocumentEmbeddedMediaItem[] | null | undefined;
  className?: string;
}) {
  const media = embeddedMedia ?? [];
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const s = text;
  for (const m of s.matchAll(IMAGEN_TAG)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      nodes.push(
        <span key={`t-${key++}`} className="library-embedded-text">
          {s.slice(last, idx)}
        </span>
      );
    }
    const n = Number.parseInt(m[1] ?? "0", 10);
    const item = media[n - 1];
    if (item?.fileName && documentId) {
      nodes.push(<AuthedDocImage key={`i-${key++}`} documentId={documentId} fileName={item.fileName} />);
    } else {
      nodes.push(
        <span key={`p-${key++}`} className="muted small">
          [Imagen {n}]
        </span>
      );
    }
    last = idx + m[0].length;
  }
  if (last < s.length) {
    nodes.push(
      <span key={`t-${key++}`} className="library-embedded-text">
        {s.slice(last)}
      </span>
    );
  }

  if (nodes.length === 0) {
    return (
      <span className={className ?? "library-embedded-text"} style={{ whiteSpace: "pre-wrap" }}>
        {s}
      </span>
    );
  }

  return (
    <div className={className} style={{ whiteSpace: "pre-wrap" }}>
      {nodes.map((n, i) => (
        <Fragment key={i}>{n}</Fragment>
      ))}
    </div>
  );
}

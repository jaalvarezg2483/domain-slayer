import { Fragment, type ReactNode } from "react";
import type { DocumentEmbeddedMediaItem } from "../api";
import { DocumentTextWithEmbeddings } from "./DocumentTextWithEmbeddings";

export type AssistantDocumentRef = {
  id: string;
  title: string;
  embeddedMedia: DocumentEmbeddedMediaItem[] | null;
};

const MARKER_LINE = /^\[\[ds-doc:([^\]]+)\]\]\s*$/;

/**
 * Respuesta del asistente: texto plano por tramos y bloques con `[[ds-doc:id]]` + figuras incrustadas.
 * Si no hay marcadores pero solo un documento tiene imágenes y el texto menciona [Imagen N], usa ese documento.
 */
export function AssistantAnswerWithEmbeddings({
  text,
  documentRefs,
}: {
  text: string;
  documentRefs: AssistantDocumentRef[];
}) {
  const byId = new Map(documentRefs.map((r) => [r.id, r.embeddedMedia]));
  const withMedia = documentRefs.filter((r) => (r.embeddedMedia?.length ?? 0) > 0);

  if (!text.includes("[[ds-doc:") && /\[imagen\s+\d+\]/i.test(text) && withMedia.length === 1) {
    const only = withMedia[0];
    return (
      <div className="assistant-chat__rich">
        <DocumentTextWithEmbeddings
          documentId={only.id}
          text={text}
          embeddedMedia={only.embeddedMedia}
        />
      </div>
    );
  }

  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let key = 0;
  let curId: string | null = null;
  let buf: string[] = [];

  const flushPlain = () => {
    if (buf.length === 0) return;
    const t = buf.join("\n");
    buf = [];
    nodes.push(
      <span key={`p-${key++}`} className="assistant-chat__plain" style={{ whiteSpace: "pre-wrap" }}>
        {t}
      </span>
    );
  };

  const flushEmb = () => {
    if (buf.length === 0) return;
    const t = buf.join("\n");
    const id = curId;
    const emb = id ? byId.get(id) ?? null : null;
    buf = [];
    curId = null;
    if (id && emb && emb.length > 0) {
      nodes.push(
        <div key={`e-${key++}`} className="assistant-chat__rich-block">
          <DocumentTextWithEmbeddings documentId={id} text={t} embeddedMedia={emb} />
        </div>
      );
    } else {
      nodes.push(
        <span key={`f-${key++}`} className="assistant-chat__plain" style={{ whiteSpace: "pre-wrap" }}>
          {t}
        </span>
      );
    }
  };

  for (const line of lines) {
    const m = MARKER_LINE.exec(line);
    if (m) {
      const id = (m[1] ?? "").trim();
      if (curId !== null) flushEmb();
      else flushPlain();
      curId = id || null;
      continue;
    }
    buf.push(line);
  }

  if (curId !== null) flushEmb();
  else flushPlain();

  if (nodes.length === 0) {
    return (
      <div className="assistant-chat__plain" style={{ whiteSpace: "pre-wrap" }}>
        {text}
      </div>
    );
  }

  return (
    <div className="assistant-chat__rich stack" style={{ gap: "0.65rem" }}>
      {nodes.map((n, i) => (
        <Fragment key={i}>{n}</Fragment>
      ))}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { api, AUTH_STORAGE_KEY, type DocumentEmbeddedMediaItem } from "../api";
import { AssistantAnswerWithEmbeddings } from "../components/AssistantAnswerWithEmbeddings";
import { IconCheck, IconClipboard } from "../components/NavIcons";
import { Spinner } from "../components/Spinner";

type Msg = {
  role: "user" | "assistant";
  text: string;
  sources?: string;
  mode?: string;
  /** Solo en respuestas correctas del API; si falta, se muestra texto plano (p. ej. mensaje de error). */
  documentRefs?: { id: string; title: string; embeddedMedia: DocumentEmbeddedMediaItem[] | null }[];
};

/** Texto plano para portapapeles (sin marcadores internos de documento). */
function assistantTextForClipboard(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !/^\[\[ds-doc:[^\]]+\]\]\s*$/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function LibraryAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.auth
      .status()
      .then((s) => setAuthRequired(Boolean(s.authRequired)))
      .catch(() => setAuthRequired(true));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setErr(null);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const r = await api.libraryAssistant.ask(q);
      const modeLabel =
        r.answerMode === "local"
          ? "Solo búsqueda en índice"
          : r.answerMode === "ollama"
            ? "Texto ampliado con Ollama (local)"
            : null;
      const src =
        r.sources != null
          ? [
              modeLabel,
              `${r.sources.siteCount} sitio(s) · ${r.sources.documentCount} fragmento(s) de documentos`,
            ]
              .filter(Boolean)
              .join(" · ")
          : modeLabel ?? undefined;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: r.answer,
          sources: src,
          mode: r.answerMode,
          documentRefs: r.documentRefs ?? [],
        },
      ]);

    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `No pude obtener respuesta: ${msg}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [input, busy]);

  const copyAssistantMessage = useCallback(async (key: string, text: string) => {
    const plain = assistantTextForClipboard(text);
    try {
      await navigator.clipboard.writeText(plain);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((k) => (k === key ? null : k));
      }, 2200);
    } catch {
      setErr("No se pudo copiar al portapapeles (permiso del navegador).");
    }
  }, []);

  const tokenPresent = typeof sessionStorage !== "undefined" && Boolean(sessionStorage.getItem(AUTH_STORAGE_KEY));
  const canUse = !authRequired || tokenPresent;

  return (
    <div className="stack library-assistant-page">
      <h1>Búsqueda inteligente</h1>
      <p className="muted small">
        Consulta unificada sobre su <strong>inventario</strong> y el <strong>texto indexado</strong> de la biblioteca
        (mismas palabras clave que en Biblioteca). La respuesta se construye con lo que hay en el índice y en los
        documentos subidos; no se añade información que no conste ahí.
      </p>

      {!canUse ? (
        <div className="card error">Inicie sesión para usar el asistente.</div>
      ) : null}

      {err && messages.length <= 1 ? <div className="card error">{err}</div> : null}

      <div className="assistant-chat card" aria-live="polite">
        {messages.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Ejemplos: «Resume todo lo que tengas sobre Te Llevo», «¿Cuándo vence el SSL del sitio X?», «¿Qué documentos
            mencionan avalúo?»
          </p>
        ) : null}
        <div className="assistant-chat__messages">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`assistant-chat__bubble assistant-chat__bubble--${m.role}`}
            >
              <div className="assistant-chat__bubble-header">
                <span className="assistant-chat__role">{m.role === "user" ? "Usted" : "Respuesta"}</span>
                {m.role === "assistant" && m.text.trim() ? (
                  <button
                    type="button"
                    className={`assistant-chat__copy-icon-btn${copiedKey === `m-${i}` ? " assistant-chat__copy-icon-btn--done" : ""}`}
                    title={copiedKey === `m-${i}` ? "Copiado" : "Copiar respuesta"}
                    aria-label={copiedKey === `m-${i}` ? "Copiado al portapapeles" : "Copiar respuesta al portapapeles"}
                    onClick={() => void copyAssistantMessage(`m-${i}`, m.text)}
                  >
                    {copiedKey === `m-${i}` ? <IconCheck /> : <IconClipboard />}
                  </button>
                ) : null}
              </div>
              <div className="assistant-chat__text">
                {m.role === "assistant" && m.documentRefs !== undefined ? (
                  <AssistantAnswerWithEmbeddings text={m.text} documentRefs={m.documentRefs} />
                ) : (
                  m.text
                )}
              </div>
              {m.sources ? <p className="muted small assistant-chat__sources">{m.sources}</p> : null}
            </div>
          ))}
          {busy ? (
            <div className="assistant-chat__bubble assistant-chat__bubble--assistant">
              <Spinner size="sm" /> Consultando biblioteca e inventario…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="assistant-chat__composer">
        <textarea
          className="input"
          rows={3}
          placeholder="Escriba su pregunta…"
          value={input}
          disabled={busy || !canUse}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="btn primary library-assistant__send"
          disabled={busy || !canUse || !input.trim()}
          aria-busy={busy}
          onClick={() => void send()}
        >
          {busy ? (
            <>
              <Spinner size="sm" /> Enviando…
            </>
          ) : (
            "Preguntar"
          )}
        </button>
      </div>
    </div>
  );
}

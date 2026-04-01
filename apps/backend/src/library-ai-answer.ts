import type { DocumentSearchHit } from "@domain-slayer/application";
import type { LlmConfig } from "./llm-config.js";
import { pickIndexedBodyForServer } from "./library-hit-body.js";
import { callChatCompletions } from "./llm-chat.js";

const MAX_EXCERPT = 14_000;
const MAX_DOCS = 8;

export type StructuredBlock = {
  title: string;
  lines: { label: string; value: string }[];
};

export type StructuredLibraryResult =
  | { ok: true; summary: string; blocks: StructuredBlock[] }
  | { ok: false; error: string };

export type LibraryAiResult =
  | { ok: true; answer: string }
  | { ok: false; error: string };

function parseJsonFromAssistant(raw: string): unknown {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/m, "");
  }
  return JSON.parse(t) as unknown;
}

function isStructuredPayload(x: unknown): x is { summary: string; blocks: StructuredBlock[] } {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.summary !== "string") return false;
  if (!Array.isArray(o.blocks)) return false;
  for (const b of o.blocks) {
    if (!b || typeof b !== "object") return false;
    const bl = b as Record<string, unknown>;
    if (typeof bl.title !== "string") return false;
    if (!Array.isArray(bl.lines)) return false;
    for (const ln of bl.lines) {
      if (!ln || typeof ln !== "object") return false;
      const L = ln as Record<string, unknown>;
      if (typeof L.label !== "string" || typeof L.value !== "string") return false;
    }
  }
  return true;
}

/**
 * Respuesta legible: agrupa por aplicación/sección, pares etiqueta-valor (valores literales del índice en biblioteca interna).
 * Requiere modelo compatible con JSON (p. ej. gpt-4o-mini).
 */
export async function structuredLibraryAnswer(
  query: string,
  items: DocumentSearchHit[],
  cfg: LlmConfig
): Promise<StructuredLibraryResult> {
  if (!query.trim() || items.length === 0) {
    return { ok: false, error: "Sin consulta o sin resultados." };
  }

  if (cfg.kind !== "openai") {
    return { ok: false, error: "structured_json_solo_openai" };
  }

  const excerpts = items.slice(0, MAX_DOCS).map((h, i) => {
    const body = pickIndexedBodyForServer(h, MAX_EXCERPT);
    return `### Documento ${i + 1}: ${h.document.title}\n${body}`;
  });

  const userContent = [
    `Consulta del usuario: «${query.trim()}»`,
    "",
    "Texto indexado (proviene de Excel u otros; puede estar desordenado):",
    excerpts.join("\n\n---\n\n"),
  ].join("\n");

  const schemaHint = `{
  "summary": "1-3 frases en español: qué se encontró respecto a la consulta",
  "blocks": [
    {
      "title": "Nombre de aplicación, entorno o sección (ej. Avalúo Digital — Producción)",
      "lines": [
        { "label": "Usuario", "value": "..." },
        { "label": "Contraseña", "value": "valor exacto del índice si consta" },
        { "label": "Ambiente", "value": "..." },
        { "label": "Notas", "value": "..." }
      ]
    }
  ]
}`;

  const res = await callChatCompletions(
    [
      {
        role: "system",
        content:
          "Eres un asistente interno que organiza información sensible de documentación (credenciales, URLs, entornos).\n" +
          "Debes devolver SOLO un JSON válido con exactamente esta forma (sin markdown ni texto fuera del JSON):\n" +
          schemaHint +
          "\n\nReglas obligatorias:\n" +
          "1) Todo en español.\n" +
          "2) Si el fragmento indexado incluye usuario o contraseña, copia el value literalmente (biblioteca interna). Si no consta, value puede ser «—» o texto breve.\n" +
          "3) Agrupa en blocks por aplicación, dashboard o entorno (Producción/Desarrollo) según el texto.\n" +
          "4) Incluye solo líneas relevantes para la consulta del usuario; si pregunta por contraseñas o avalúo, prioriza esas filas.\n" +
          "5) Si hay varias cuentas, crea un block por cada grupo lógico (no mezcles producción y desarrollo sin título claro).\n" +
          "6) Usa labels claros: Usuario, Contraseña, Ambiente, URL, Tipo de acceso, Descripción, etc.\n" +
          "7) Si no hay datos útiles, blocks = [] y summary lo explica.",
      },
      { role: "user", content: userContent },
    ],
    cfg,
    { temperature: 0.15, max_tokens: 2800, response_format: { type: "json_object" } }
  );

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  const raw = res.text;
  let parsed: unknown;
  try {
    parsed = parseJsonFromAssistant(raw);
  } catch {
    return { ok: false, error: "No se pudo interpretar el JSON del modelo." };
  }

  if (!isStructuredPayload(parsed)) {
    return { ok: false, error: "Formato de respuesta IA inesperado." };
  }

  return { ok: true, summary: parsed.summary, blocks: parsed.blocks };
}

/**
 * Resumen en texto plano (reserva). Preferir {@link structuredLibraryAnswer}.
 */
export async function summarizeLibraryHits(
  query: string,
  items: DocumentSearchHit[],
  cfg: LlmConfig
): Promise<LibraryAiResult> {
  if (!query.trim() || items.length === 0) {
    return { ok: false, error: "Sin consulta o sin resultados para resumir." };
  }

  const excerpts = items.slice(0, MAX_DOCS).map((h, i) => {
    const body = pickIndexedBodyForServer(h, MAX_EXCERPT);
    return `### Documento ${i + 1}: ${h.document.title}\n${body}`;
  });

  const userContent = [
    `Pregunta del usuario: ${query.trim()}`,
    "",
    "Fragmentos indexados (pueden tener restos de tablas o CSV; interpreta el significado):",
    excerpts.join("\n\n---\n\n"),
  ].join("\n");

  const out = await callChatCompletions(
    [
      {
        role: "system",
        content:
          "Eres un asistente interno. Respondes en español de forma breve y clara. " +
          "Sintetiza solo lo que aparece en los fragmentos. Si faltan datos, dilo. " +
          "No inventes URLs ni datos no citados. Si usuario y contraseña figuran en el texto, repítelos tal cual (biblioteca autenticada).",
      },
      { role: "user", content: userContent },
    ],
    cfg,
    { temperature: 0.25, max_tokens: cfg.kind === "ollama" ? 1200 : 700 }
  );

  if (!out.ok) {
    return { ok: false, error: out.error };
  }
  return { ok: true, answer: out.text };
}

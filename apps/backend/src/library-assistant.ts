import type { DocumentSearchHit } from "@domain-slayer/application";
import { pickIndexedBodyForServer } from "./library-hit-body.js";
import { buildLocalAssistantAnswer } from "./library-local-intel.js";
import { callChatCompletions } from "./llm-chat.js";
import { resolveLlmConfig } from "./llm-config.js";

const MAX_DOCS = 12;
const MAX_EXCERPT_PER_DOC = 200_000;
const MAX_CONTEXT_CHARS = 750_000;

export type LibraryAssistantResult =
  | { ok: true; answer: string; mode: "local" | "ollama" }
  | { ok: false; error: string };

function formatDate(v: unknown): string {
  if (v == null) return "—";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "—" : v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const d = v.slice(0, 10);
    return d || "—";
  }
  return "—";
}

function siteBlock(s: Record<string, unknown>): string {
  const name = String(s.siteName ?? s.name ?? "Sitio");
  const url = String(s.url ?? "—");
  const domain = String(s.domain ?? "—");
  const env = String(s.environment ?? "—");
  const active = s.isActive === false ? "no" : "sí";
  const notes = s.notes != null && String(s.notes).trim() ? String(s.notes).slice(0, 2000) : "";
  const sslNotes =
    s.sslResolutionNotes != null && String(s.sslResolutionNotes).trim()
      ? String(s.sslResolutionNotes).slice(0, 1500)
      : "";
  const domNotes =
    s.domainResolutionNotes != null && String(s.domainResolutionNotes).trim()
      ? String(s.domainResolutionNotes).slice(0, 1500)
      : "";
  const lines = [
    `### ${name}`,
    `- URL: ${url}`,
    `- Dominio: ${domain}`,
    `- Entorno: ${env}`,
    `- Activo en inventario: ${active}`,
    `- SSL válido hasta (sistema): ${formatDate(s.sslValidToFinal ?? s.sslValidTo)}`,
    `- Vencimiento dominio (calculado): ${formatDate(s.domainExpiryFinal)}`,
    `- Estado SSL (chequeo): ${String(s.sslStatus ?? "—")}`,
    `- Estado dominio: ${String(s.domainStatus ?? "—")}`,
  ];
  if (notes) lines.push(`- Notas inventario: ${notes}`);
  if (sslNotes) lines.push(`- Notas renovación SSL: ${sslNotes}`);
  if (domNotes) lines.push(`- Notas renovación dominio: ${domNotes}`);
  return lines.join("\n");
}

function buildUserPayload(
  question: string,
  sites: Record<string, unknown>[],
  hits: DocumentSearchHit[]
): string {
  const siteSection =
    sites.length > 0
      ? ["## Sitios del inventario (coinciden con la búsqueda o están vinculados a documentos)", ...sites.map(siteBlock)].join(
          "\n\n"
        )
      : "## Sitios del inventario\n(No se encontraron sitios cuyo nombre, dominio, URL, notas de inventario ni notas de SSL/dominio coincidan con la búsqueda.)";

  const docParts: string[] = ["## Documentos de la biblioteca (texto indexado)"];
  if (hits.length === 0) {
    docParts.push("(No hay fragmentos de documentos que coincidan con la búsqueda por palabras clave.)");
  } else {
    hits.slice(0, MAX_DOCS).forEach((h, i) => {
      const title = h.document.title;
      const st = h.document.siteId ? `Sitio vinculado: ${h.siteName} (${h.domain})` : "Documento global (sin sitio único)";
      const body = pickIndexedBodyForServer(h, MAX_EXCERPT_PER_DOC);
      docParts.push(`### Documento ${i + 1}: ${title}\n${st}\n\n${body}`);
    });
  }

  let text = [
    `Pregunta del usuario: «${question.trim()}»`,
    "",
    siteSection,
    "",
    docParts.join("\n\n"),
  ].join("\n");

  if (text.length > MAX_CONTEXT_CHARS) {
    text = text.slice(0, MAX_CONTEXT_CHARS) + "\n\n[…contexto truncado por tamaño…]";
  }
  return text;
}

/**
 * Asistente restringido: solo inventario + documentos indexados.
 * Sin modelo configurado: respuesta solo con datos de biblioteca e inventario. Con LLM: redacta a partir del mismo contexto.
 */
export async function libraryDedicatedAssistant(
  question: string,
  ctx: { sites: Record<string, unknown>[]; documentHits: DocumentSearchHit[] }
): Promise<LibraryAssistantResult> {
  if (!question.trim()) {
    return { ok: false, error: "Pregunta vacía." };
  }

  const localAnswer = buildLocalAssistantAnswer(question, ctx.documentHits, ctx.sites);
  const cfg = resolveLlmConfig();
  if (!cfg) {
    return { ok: true, answer: localAnswer, mode: "local" };
  }

  const userContent = buildUserPayload(question, ctx.sites, ctx.documentHits);
  const system = [
    "Eres el asistente dedicado de DomainSlayer para la biblioteca de documentos y el inventario de sitios.",
    "",
    "REGLAS OBLIGATORIAS:",
    "1) Solo puedes usar datos que aparezcan explícitamente en el mensaje del usuario, en las secciones «Sitios del inventario» y «Documentos de la biblioteca».",
    "2) Si algo no consta ahí, dilo con claridad (p. ej. «No aparece en la biblioteca ni en el inventario»). No inventes URLs, fechas, contraseñas ni contactos.",
    "3) Responde en español, tono profesional y conversacional. Adapta la respuesta a lo que preguntan (resumen, lista, fechas, etc.).",
    "3b) Si la pregunta es concreta (p. ej. un solo enlace, un solo documento), responde solo con eso; no listes otras marcas ni filas del Excel que no pidieron.",
    "4) Cuando hable de un sitio, prioriza: nombre, URL, dominio, vencimiento SSL, vencimiento de dominio, notas de renovación y lo que digan los documentos.",
    "5) No omitas filas Usuario/Contraseña que vengan en el contexto; el usuario necesita credenciales operativas del índice.",
    "6) Si el usuario pregunta de forma abierta («qué puedes decirme», «qué más hay»), resume lo disponible y ofrece 2–4 preguntas de seguimiento concretas basadas solo en lo que sí aparece en el contexto.",
    "7) Si en el contexto aparecen líneas exactas del tipo [[ds-doc:ID]] (antes del título de un documento), cópialas tal cual en tu respuesta, una por documento, inmediatamente antes del bloque de texto de ese documento (título, viñetas, [Imagen N], etc.). Sirven para mostrar capturas en la interfaz.",
  ].join("\n");

  const out = await callChatCompletions(
    [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    cfg,
    { temperature: 0.2, max_tokens: 1800 }
  );

  if (out.ok) {
    return {
      ok: true,
      answer: out.text,
      mode: "ollama",
    };
  }

  return {
    ok: true,
    answer: `${localAnswer}\n\n---\nNo se pudo completar la respuesta del asistente. Mostramos solo la información encontrada en biblioteca e inventario.`,
    mode: "local",
  };
}

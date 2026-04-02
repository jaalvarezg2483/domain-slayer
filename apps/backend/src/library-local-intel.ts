import type { DocumentSearchHit } from "@domain-slayer/application";
import { foldSpanishAccents } from "@domain-slayer/shared";
import { pickIndexedBodyForServer } from "./library-hit-body.js";

/** Separa campos típicos de tablas «Claves de acceso» pegados en una sola línea. */
export function formatLibraryExcerptForDisplay(raw: string): string {
  let t = raw.replace(/\s*─{3,}\s*/g, "\n\n").trim();
  const beforeLabel =
    /\s+(\[Encabezados\s+de\s+la\s+hoja:|Documentaci[oó]n\s+Accenture:|Columna\s+\d+:|Plataforma:|Descripci[oó]n\s+de\s+plataforma|Hospedaje\s+Producci[oó]n:|Enlace\s+Producc(ió|io)n:|Enlace\s+Desarrollo:|Sitio\/Sistema:|Sitio:|Usuario:|Contraseña:|Contrasena:|Ambiente:|Uso:|Referencia\/Base de datos:|Url\/Endpoint:|Servicio:|Repositorio:|Comentario:|Comentarios:)/gi;
  t = t.replace(beforeLabel, "\n\n$1");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/** Marcadores del extractor Excel en `extract-document-text.ts` (no aparecen en Word/PDF normales). */
const EXCEL_INDEX_MARKERS = [
  /---\s*Fila\s+\d+/i,
  /===\s*Hoja:/i,
  /\[\s*Encabezados\s+de\s+la\s+hoja:/i,
  /\bcredencial\s+\d+\b/i,
] as const;

function indexedTextLooksLikeExcelExtract(text: string | null | undefined): boolean {
  if (text == null || !String(text).trim()) return false;
  return EXCEL_INDEX_MARKERS.some((re) => re.test(text));
}

function isWordLikeDocument(fileName: string | null | undefined, mimeType: string | null | undefined): boolean {
  const n = (fileName ?? "").toLowerCase();
  const m = (mimeType ?? "").toLowerCase();
  return n.endsWith(".docx") || m.includes("wordprocessingml");
}

function isPdfLikeDocument(fileName: string | null | undefined, mimeType: string | null | undefined): boolean {
  const n = (fileName ?? "").toLowerCase();
  const m = (mimeType ?? "").toLowerCase();
  return n.endsWith(".pdf") || m.includes("/pdf");
}

/**
 * El formateador de tablas de credenciales asume pares «Etiqueta: valor» estilo inventario Excel.
 * En Word/PDF, frases como «ERROR 3: Error writing file…» o «Documentación: …» no son credenciales;
 * solo aplicamos la tabla si el índice tiene señales claras de Excel.
 */
export function shouldApplyCredentialTableFormatting(hit: DocumentSearchHit): boolean {
  const doc = hit.document;
  const full = doc.searchText ?? "";
  if (isWordLikeDocument(doc.fileName, doc.mimeType) || isPdfLikeDocument(doc.fileName, doc.mimeType)) {
    return indexedTextLooksLikeExcelExtract(full);
  }
  return true;
}

const CREDENTIAL_FIELD_ORDER = [
  "Plataforma",
  "Sitio/Sistema",
  "Sitio",
  "Descripción de plataforma (tecnología)",
  "Dependencia",
  "Versión",
  "Sub Dependencia",
  "Pertenece a/Se instala con",
  "Enlace Producción",
  "Enlace Desarrollo",
  "Hospedaje Producción",
  "¿Quién lo administra?",
  "Servicio",
  "Usuario",
  "Contraseña",
  "Ambiente",
  "Uso",
  "Referencia/Base de datos",
  "Referencia",
  "Url/Endpoint",
  "Repositorio",
  "Rama de Producción",
  "Rama de Prod",
  "Comentario",
  "Comentarios",
] as const;

/** Orden de preferencia para el título del bloque (mismo texto que en el Excel). */
const TITLE_FIELD_KEYS = ["Plataforma", "Sitio/Sistema", "Sitio"] as const;

function normalizeCredentialFieldKey(key: string): string {
  const k = key.replace(/\s+/g, " ").trim();
  if (/^contrasena$/i.test(k)) return "Contraseña";
  if (/^enlace\s+produccion$/i.test(k)) return "Enlace Producción";
  if (/^enlace\s+desarrollo$/i.test(k)) return "Enlace Desarrollo";
  if (/^version$/i.test(k)) return "Versión";
  if (/^sub\s+dependencia$/i.test(k)) return "Sub Dependencia";
  if (/^pertenece\s+a/i.test(k)) return "Pertenece a/Se instala con";
  if (/quien\s+lo\s+administra/i.test(k)) return "¿Quién lo administra?";
  if (/^descripcion\s+de\s+plataforma/i.test(k)) return "Descripción de plataforma (tecnología)";
  if (/^hospedaje\s+produccion$/i.test(k)) return "Hospedaje Producción";
  if (/^rama\s+de\s+prod/i.test(k)) return "Rama de Producción";
  return k;
}

function normFieldVal(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** Valores que no deben mostrarse (celda vacía, N/A, guiones). */
function isPlaceholderFieldValue(raw: string | undefined): boolean {
  const v = normFieldVal(raw);
  if (!v) return true;
  if (/^(n\/?a|no\s+aplica|sin\s+datos|vac[ií]o)$/i.test(v)) return true;
  if (/^[-–—\.]+$/.test(v)) return true;
  return false;
}

function isDisplayableFieldValue(raw: string | undefined): boolean {
  return !isPlaceholderFieldValue(raw);
}

const ORDER_SET = new Set<string>(CREDENTIAL_FIELD_ORDER);

function recordDisplayableEntries(r: Record<string, string>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const used = new Set<string>();
  for (const k of CREDENTIAL_FIELD_ORDER) {
    if (!isDisplayableFieldValue(r[k])) continue;
    out.push([k, normFieldVal(r[k])]);
    used.add(k);
  }
  for (const k of Object.keys(r).sort()) {
    if (used.has(k) || ORDER_SET.has(k)) continue;
    if (!isDisplayableFieldValue(r[k])) continue;
    out.push([k, normFieldVal(r[k])]);
    used.add(k);
  }
  return out;
}

function pickTitleField(r: Record<string, string>): { key: string; value: string } | null {
  for (const k of TITLE_FIELD_KEYS) {
    if (isDisplayableFieldValue(r[k])) return { key: k, value: normFieldVal(r[k]) };
  }
  return null;
}

function recordHasUsefulContent(r: Record<string, string>): boolean {
  return recordDisplayableEntries(r).length > 0;
}

function looksLikeStructuredTableRecord(r: Record<string, string>): boolean {
  const n = recordDisplayableEntries(r).length;
  if (n >= 2) return true;
  if (isDisplayableFieldValue(r.Usuario) || isDisplayableFieldValue(r.Contraseña)) return true;
  if (isDisplayableFieldValue(r.Plataforma)) return true;
  if (isDisplayableFieldValue(r["Sitio/Sistema"]) || isDisplayableFieldValue(r.Sitio)) return true;
  return false;
}

/** Varias filas Excel con la misma celda combinada «Sitio» no deben partirse en credenciales distintas. */
function sitioFlushValueDiffers(cur: Record<string, string>, newSitioVal: string): boolean {
  const prev = cur.Sitio ?? cur["Sitio/Sistema"];
  if (prev == null) return false;
  return normFieldVal(prev) !== normFieldVal(newSitioVal);
}

/**
 * Filas solo técnicas (sin usuario/clave) con mismo comentario + dependencia + versión: unir Sub Dependencia.
 */
function mergeAdjacentInfrastructureRows(records: Array<Record<string, string>>): Array<Record<string, string>> {
  if (records.length <= 1) return records;

  const techOnly = (r: Record<string, string>) =>
    !normFieldVal(r.Usuario) &&
    !normFieldVal(r.Contraseña) &&
    !normFieldVal(r.Plataforma) &&
    !normFieldVal(r["Enlace Producción"]) &&
    !normFieldVal(r["Enlace Desarrollo"]) &&
    !normFieldVal(r.Repositorio);

  const out: Array<Record<string, string>> = [];
  let i = 0;
  while (i < records.length) {
    const r = records[i];
    if (!techOnly(r) || !techOnly(records[i + 1] ?? {})) {
      out.push(r);
      i++;
      continue;
    }

    const c0 = normFieldVal(r.Comentarios ?? r.Comentario);
    const d0 = normFieldVal(r.Dependencia);
    const v0 = normFieldVal(r.Versión);
    const subParts: string[] = [];
    let j = i;
    while (j < records.length && techOnly(records[j])) {
      const x = records[j];
      const c = normFieldVal(x.Comentarios ?? x.Comentario);
      const d = normFieldVal(x.Dependencia);
      const v = normFieldVal(x.Versión);
      if (c !== c0 || d !== d0 || v !== v0) break;
      const sd = normFieldVal(x["Sub Dependencia"]);
      if (sd) subParts.push(sd);
      j++;
    }

    if (j - i >= 2 && subParts.length >= 2) {
      const merged = { ...r };
      merged["Sub Dependencia"] = subParts.join(" · ");
      out.push(merged);
      i = j;
      continue;
    }
    out.push(r);
    i++;
  }
  return out;
}

function stableRecordSignature(r: Record<string, string>): string {
  const keys = Object.keys(r).sort();
  return keys.map((k) => `${k}=${normFieldVal(r[k])}`).join("|");
}

/** Evita «Credencial N» duplicadas con el mismo contenido (p. ej. filas Excel repetidas). */
function collapseConsecutiveDuplicateRecords(records: Array<Record<string, string>>): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  for (const r of records) {
    const sig = stableRecordSignature(r);
    const last = out[out.length - 1];
    if (last && stableRecordSignature(last) === sig) continue;
    out.push(r);
  }
  return out;
}

/** Términos genéricos de la pregunta que no discriminan entre filas del mismo sitio. */
const CREDENTIAL_QUESTION_STOPWORDS = new Set(
  [
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "de",
    "del",
    "y",
    "o",
    "en",
    "a",
    "al",
    "por",
    "para",
    "con",
    "sin",
    "que",
    "es",
    "son",
    "hay",
    "me",
    "te",
    "se",
    "le",
    "lo",
    "su",
    "sus",
    "cual",
    "como",
    "donde",
    "dame",
    "muestra",
    "necesito",
    "busco",
    "tengo",
    "ver",
    "abrir",
    "dime",
    "favor",
    "contraseña",
    "contrasena",
    "clave",
    "credencial",
    "password",
    "usuario",
    "acceso",
    "login",
    "ambiente",
    "documentacion",
    "documento",
    "biblioteca",
    "informacion",
    "info",
    "pwd",
    "pass",
  ].map((w) => foldSpanishAccents(w))
);

function discriminativeTokensFromQuestion(question: string): string[] {
  const raw = question
    .replace(/[[\]()"'«».,;:¿?¡!/\\]+/g, " ")
    .split(/\s+/)
    .map((t) => foldSpanishAccents(t.trim()))
    .filter((t) => t.length >= 2 && !CREDENTIAL_QUESTION_STOPWORDS.has(t));
  return [...new Set(raw)];
}

function recordToFoldedHaystack(r: Record<string, string>): string {
  const parts: string[] = [];
  for (const k of Object.keys(r).sort()) {
    parts.push(foldSpanishAccents(k), foldSpanishAccents(r[k] ?? ""));
  }
  return parts.join(" ");
}

/** Fila «base de datos» suele tener Uso: MySQL sin la palabra «base» en el valor. */
const DB_STACK_FOLDED =
  /mysql|mariadb|mongo(db)?|postgres(ql)?|oracle|sqlserver|sql\b|jdbc|sqlite|redis|elasticsearch|h2\b|base\s+de\s+datos|\bbd\b/;

/** Coincidencia de token en texto ya plegado (sin tildes). */
function foldedHaystackIncludesToken(hay: string, token: string): boolean {
  if (!token) return true;
  if (token === "dev" || token === "desarrollo") {
    return hay.includes("desarrollo") || /(^|[^a-z0-9])dev([^a-z0-9]|$)/.test(hay);
  }
  if (token === "prod" || token === "produccion") {
    return hay.includes("produccion") || /(^|[^a-z0-9])prod([^a-z0-9]|$)/.test(hay);
  }
  if (token === "base" || token === "datos" || token === "bd") {
    return hay.includes("base") || hay.includes("datos") || DB_STACK_FOLDED.test(hay);
  }
  if (token.length <= 2) {
    return new RegExp(
      `(^|[^a-z0-9áéíóúñü])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9áéíóúñü]|$)`,
      "i"
    ).test(hay);
  }
  return hay.includes(token);
}

/**
 * Cuando la pregunta es específica (2+ términos discriminativos), deja solo filas cuyo contenido
 * contiene todos esos términos (p. ej. toyota + mysql + desarrollo → no incluye Sonata).
 */
function filterCredentialRecordsByQuestion(
  records: Array<Record<string, string>>,
  question: string
): Array<Record<string, string>> {
  const q = question.trim();
  if (!q) return records;
  const tokens = discriminativeTokensFromQuestion(q);
  if (tokens.length < 2) return records;

  const filtered = records.filter((r) => {
    const hay = recordToFoldedHaystack(r);
    return tokens.every((t) => foldedHaystackIncludesToken(hay, t));
  });
  return filtered.length > 0 ? filtered : records;
}

function parseCredentialRecords(formattedMultiline: string): Array<Record<string, string>> {
  const lines = formattedMultiline.split("\n").map((l) => l.trim());
  const records: Array<Record<string, string>> = [];
  let cur: Record<string, string> = {};

  const flush = () => {
    if (Object.keys(cur).length > 0) {
      records.push(cur);
      cur = {};
    }
  };

  for (const line of lines) {
    if (!line) continue;
    if (/^---\s*Fila\s+\d+\s*---$/i.test(line)) {
      flush();
      continue;
    }
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const rawKey = line.slice(0, idx).trim().replace(/\s+/g, " ");
    const key = normalizeCredentialFieldKey(rawKey);
    const val = line.slice(idx + 1).trim();
    if (!key) continue;
    if (!val) continue;

    if (/^Documentaci[oó]n\s+Accenture$/i.test(key) && Object.keys(cur).length > 0) {
      flush();
    }
    if (key === "Plataforma" && Object.keys(cur).length > 0) {
      flush();
    }
    if ((key === "Sitio/Sistema" || key === "Sitio") && Object.keys(cur).length > 0) {
      if (sitioFlushValueDiffers(cur, val)) {
        flush();
      }
    }
    if (key === "Usuario" && cur["Usuario"]) {
      flush();
    }

    cur[key] = val;
  }
  flush();
  return records;
}

/**
 * Formatea filas tipo Excel/Accenture: título con el encabezado real (p. ej. Plataforma / Sitio/Sistema),
 * sin numerar «Credencial N», sin campos vacíos ni N/A. «Contraseña» solo aparece si existe ese campo en el texto.
 * Con `question`, recorta a las filas que contienen todos los términos discriminativos de la pregunta.
 */
export function formatCredentialLinesAsTable(formattedMultiline: string, question?: string): string {
  const rawRecords = parseCredentialRecords(formattedMultiline).filter((r) => Object.keys(r).length > 0);
  let records = collapseConsecutiveDuplicateRecords(mergeAdjacentInfrastructureRows(rawRecords)).filter((r) =>
    recordHasUsefulContent(r)
  );
  if (records.length === 0) return formattedMultiline;

  if (!records.some(looksLikeStructuredTableRecord)) return formattedMultiline;

  if (question?.trim()) {
    records = filterCredentialRecordsByQuestion(records, question);
  }

  const blocks: string[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    const entries = recordDisplayableEntries(r);
    if (entries.length === 0) continue;

    const title = pickTitleField(r);
    let body = entries;
    if (title) {
      body = entries.filter(([k]) => k !== title.key);
    }

    if (i > 0) blocks.push("");
    if (title) {
      blocks.push(`${title.key}: ${title.value}`);
    } else {
      const [headK, headV] = body[0]!;
      blocks.push(`${headK}: ${headV}`);
      body = body.slice(1);
    }
    for (const [k, v] of body) {
      blocks.push(`  ${k}: ${v}`);
    }
  }
  return blocks.join("\n");
}

function fmtDate(v: unknown): string {
  if (v == null) return "—";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "—" : v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10) || "—";
  return "—";
}

/**
 * Respuesta del asistente sin LLM: solo datos útiles (inventario + fragmentos), sin metadatos técnicos.
 */
export function buildLocalAssistantAnswer(
  question: string,
  documentHits: DocumentSearchHit[],
  sites: Record<string, unknown>[]
): string {
  const lines: string[] = [];

  if (sites.length > 0) {
    lines.push("Inventario");
    lines.push("");
    for (const s of sites) {
      const name = String(s.siteName ?? "Sitio");
      lines.push(name);
      lines.push(`  URL: ${String(s.url ?? "—")}`);
      lines.push(`  Dominio: ${String(s.domain ?? "—")}`);
      lines.push(`  SSL válido hasta (sistema): ${fmtDate(s.sslValidToFinal ?? s.sslValidTo)}`);
      lines.push(`  Vencimiento dominio: ${fmtDate(s.domainExpiryFinal)}`);
      const notes = s.notes != null ? String(s.notes).trim() : "";
      if (notes) {
        const short = notes.length > 450 ? `${notes.slice(0, 450)}…` : notes;
        lines.push(`  Notas inventario: ${short}`);
      }
      const sslNotes = s.sslResolutionNotes != null ? String(s.sslResolutionNotes).trim() : "";
      if (sslNotes) {
        const short = sslNotes.length > 400 ? `${sslNotes.slice(0, 400)}…` : sslNotes;
        lines.push(`  Notas renovación SSL: ${short}`);
      }
      const domNotes = s.domainResolutionNotes != null ? String(s.domainResolutionNotes).trim() : "";
      if (domNotes) {
        const short = domNotes.length > 400 ? `${domNotes.slice(0, 400)}…` : domNotes;
        lines.push(`  Notas renovación dominio: ${short}`);
      }
      lines.push("");
    }
  }

  if (documentHits.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("Documentos");
    lines.push("");
    const bySite = new Map<string, DocumentSearchHit[]>();
    for (const h of documentHits) {
      const k = h.siteName?.trim() || "Biblioteca global";
      if (!bySite.has(k)) bySite.set(k, []);
      bySite.get(k)!.push(h);
    }
    for (const [siteName, hits] of bySite) {
      lines.push(siteName);
      lines.push("");
      for (const h of hits) {
        const hasEmb = (h.document.embeddedMedia?.length ?? 0) > 0;
        if (hasEmb) {
          lines.push(`[[ds-doc:${h.document.id}]]`);
        }
        lines.push(h.document.title);
        const rawBody = pickIndexedBodyForServer(h, 200_000).trim();
        const body = rawBody;
        if (body) {
          const maxChars = h.snippet ? 200_000 : 80_000;
          const clip =
            body.length > maxChars
              ? `${body.slice(0, maxChars)}…\n[Fragmento recortado por tamaño; abra el documento en la biblioteca para verlo completo.]`
              : body;
          const formatted = formatLibraryExcerptForDisplay(clip);
          const blocked = shouldApplyCredentialTableFormatting(h)
            ? formatCredentialLinesAsTable(formatted, question)
            : formatted;
          if (blocked !== formatted) {
            for (const part of blocked.split("\n")) {
              lines.push(part.trimEnd() ? `  ${part.trimEnd()}` : "");
            }
          } else {
            for (const part of formatted.split("\n")) {
              const row = part.trimEnd();
              lines.push(row.trim() ? `  ${row.trim()}` : "");
            }
          }
        }
        lines.push("");
      }
    }
  }

  if (sites.length === 0 && documentHits.length === 0) {
    lines.push("No encontré coincidencias en el inventario ni en los documentos indexados.");
    lines.push("Pruebe otras palabras o compruebe que el archivo tiene texto extraíble.");
  }

  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd();
}

/** Texto breve para la búsqueda de biblioteca con resumen sin LLM. */
export function buildLocalSearchSummary(question: string, hits: DocumentSearchHit[]): string {
  if (hits.length === 0) {
    return "Sin resultados para esta búsqueda.";
  }
  const lines: string[] = [`«${question.trim()}» — ${hits.length} documento(s)`, ""];
  for (const h of hits.slice(0, 18)) {
    lines.push(`• ${h.document.title} — ${h.siteName} (${h.domain})`);
    const excerpt = pickIndexedBodyForServer(h, 12_000);
    if (excerpt) {
      const s = excerpt.length > 900 ? `${excerpt.slice(0, 900)}…` : excerpt;
      const formatted = formatLibraryExcerptForDisplay(s);
      const blocked = shouldApplyCredentialTableFormatting(h)
        ? formatCredentialLinesAsTable(formatted, question)
        : formatted;
      const use = blocked !== formatted ? blocked : formatted;
      for (const part of use.split("\n")) {
        const row = part.trimEnd();
        lines.push(row.trim() ? `  ${row.trim()}` : "");
      }
    }
    lines.push("");
  }
  if (hits.length > 18) {
    lines.push(`… y ${hits.length - 18} más en la lista.`);
  }
  return lines.join("\n").trimEnd();
}

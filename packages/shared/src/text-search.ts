/**
 * Normaliza para comparar en español: minúsculas y sin tildes (NFD).
 * Alinea índices con el string original en la práctica habitual (misma longitud en caracteres).
 */
export function foldSpanishAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Palabras muy frecuentes que suelen añadir ruido en búsquedas OR (inventario + biblioteca). */
const SEARCH_STOPWORDS_ES = new Set([
  "el",
  "la",
  "de",
  "en",
  "un",
  "una",
  "y",
  "o",
  "a",
  "al",
  "del",
  "los",
  "las",
  "que",
  "con",
  "por",
  "para",
  "como",
  "se",
  "es",
  "su",
  "sus",
  "lo",
  "les",
  "me",
  "te",
  "le",
  "mi",
  "tu",
  "ya",
  "hay",
  "son",
  "ser",
  "fue",
  "han",
  "más",
  "muy",
  "no",
  "si",
  "cual",
  "cuales",
  "cuando",
  "donde",
  /* Preguntas coloquiales; «ver» como token hace LIKE %ver% y coincide con «verifique», «server», etc. */
  "ver",
  "quiero",
  "muestra",
  "mostrar",
  "mostrame",
  "muestre",
  "necesito",
  "busco",
  "buscar",
  "decir",
  "diga",
  "tengo",
  "habria",
  "habia",
  "podrias",
  "podria",
  "puedes",
  "puede",
]);

/**
 * Escapa `%`, `_` y `\` para usar el término como literal en `LIKE … ESCAPE '\\'` (SQLite / TypeORM).
 */
export function escapeSqlLikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Normaliza la consulta y la divide en palabras clave (mín. 2 caracteres; máx. 24 términos).
 * Quita stopwords en español cuando queda al menos un término útil (mejor recall en frases largas).
 * Conserva `_` y `%` en los términos (p. ej. `usr_toyotacr`); el repositorio escapa LIKE.
 */
export function tokenizeSearchQuery(q: string): string[] {
  const raw = q.trim();
  if (!raw) return [];

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  let parts = normalized
    .split(/[\s,;]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (parts.length === 0 && normalized.replace(/\s+/g, " ").trim().length >= 2) {
    parts = [normalized.replace(/\s+/g, " ").trim()];
  }

  const withoutStop = parts.filter((t) => !SEARCH_STOPWORDS_ES.has(t));
  if (withoutStop.length > 0) {
    parts = withoutStop;
  } else if (parts.length > 0 && parts.every((t) => SEARCH_STOPWORDS_ES.has(t))) {
    /* Evitar OR con solo stopwords (p. ej. «el la de») que ensucia inventario y asistente. */
    return [];
  }

  /** Una sola forma por término (p. ej. contraseñas → contraseña) para que LIKE y snippets coincidan con el Excel. */
  const lemma = (t: string): string => {
    const m: Record<string, string> = {
      contrasenas: "contrasena",
      contrasena: "contrasena",
      claves: "clave",
      clave: "clave",
      credenciales: "credencial",
      credencial: "credencial",
      passwords: "password",
      password: "password",
      usuarios: "usuario",
      usuario: "usuario",
      repositorios: "repositorio",
      repositorio: "repositorio",
    };
    return m[t] ?? t;
  };

  /**
   * Excel suele decir «Enlace Desarrollo»; el usuario dice «url». Unificamos para que el SQL y los fragmentos coincidan.
   */
  const canonSearchSynonym = (t: string): string => {
    const m: Record<string, string> = {
      url: "enlace",
      urls: "enlace",
      uri: "enlace",
      link: "enlace",
      links: "enlace",
      href: "enlace",
      hipervinculo: "enlace",
      hipervinculos: "enlace",
      dev: "desarrollo",
      prod: "produccion",
      produccion: "produccion",
      repository: "repositorio",
      repo: "repositorio",
      repos: "repositorio",
      sets: "set",
    };
    return m[t] ?? t;
  };

  return [...new Set(parts.map((t) => canonSearchSynonym(lemma(t))))].slice(0, 24);
}

/** Reduce ruido visual de CSV/Excel antiguo en extractos mostrados al usuario. */
export function prettifyCommaNoise(s: string): string {
  const normalized = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) =>
      line
        .replace(/,{3,}/g, " · ")
        .replace(/,{2}/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\s*·\s*/g, " · ")
        .replace(/^\s+|\s+$/g, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convierte filas tipo CSV (muchas comas y columnas vacías) en lista legible para pantalla/informes.
 */
function splitDenseCommaRow(s: string): string[] {
  return s
    .split(/,+/)
    .map((p) => p.trim().replace(/\s+/g, " "))
    .filter((p) => p.length > 0);
}

function looksLikeDenseSpreadsheetDump(s: string): boolean {
  const commas = (s.match(/,/g) ?? []).length;
  if (commas < 5) return false;
  const len = Math.max(s.length, 1);
  if (/,{3,}/.test(s)) return true;
  if (commas / len > 0.045) return true;
  const parts = s.split(/,/);
  const nonEmpty = parts.filter((p) => p.trim().length > 0).length;
  return commas >= 8 && nonEmpty < parts.length * 0.35;
}

const SNIPPET_MAX_CHARS = 2800;
const SNIPPET_MAX_BULLETS = 16;

/** Límite al unir bloques que coinciden con la búsqueda (credenciales / filas largas). */
const MULTI_ROW_SNIPPET_TOTAL = 120_000;
const MULTI_ROW_SNIPPET_PER_SEGMENT = 24_000;

/**
 * Formato presentable para snippets de biblioteca (evita “sopas de comas” de Excel antiguo).
 * @param maxChars — si se omite, usa el tope corto de lista; use un valor mayor para una fila completa.
 */
export function formatSnippetForPresentation(s: string, maxChars?: number): string {
  let t = s.trim();
  if (!t) return t;

  if (looksLikeDenseSpreadsheetDump(t)) {
    const parts = splitDenseCommaRow(t);
    if (parts.length >= 2) {
      const slice = parts.slice(0, SNIPPET_MAX_BULLETS);
      let out =
        slice.length > 4
          ? slice.map((p) => `• ${p}`).join("\n")
          : slice.join(" · ");
      if (parts.length > SNIPPET_MAX_BULLETS) {
        out += `\n… (${parts.length - SNIPPET_MAX_BULLETS} valores más en el documento)`;
      }
      t = out;
    } else {
      t = prettifyCommaNoise(t);
    }
  } else {
    t = prettifyCommaNoise(t);
  }

  const cap = maxChars ?? SNIPPET_MAX_CHARS;
  if (t.length > cap) {
    t = t.slice(0, cap).trimEnd() + "…";
  }
  return t;
}

function normalizeSnippetWhitespace(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/\r\n/g, "\n");
}

/** Quita marcadores de fila del extractor para un extracto más limpio. */
export function stripLibraryFilaMarkers(s: string): string {
  return s.replace(/---\s*Fila\s+\d+\s*---\s*/gi, "").trim();
}

/** Subcadena basta (etiquetas de Excel, columnas). «enlace» se trata aparte (evita ruido en descripciones). */
const SUBSTRING_MATCH_LEMMAS = new Set([
  "contrasena",
  "clave",
  "credencial",
  "password",
  "usuario",
  "acceso",
  "desarrollo",
  "produccion",
  "repositorio",
]);

/** Quita URLs para no contar «toyota» dentro de dominios (toyotacr, api-gateway…). */
export function stripUrlsForLibraryMatch(s: string): string {
  return s.replace(/https?:\/\/[^\s)\]]+/gi, " ");
}

function foldedWholeWordEntity(hayFolded: string, needleFolded: string): boolean {
  if (needleFolded.length < 2) return hayFolded.includes(needleFolded);
  const esc = needleFolded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9áéíóúñü])${esc}(?:[^a-z0-9áéíóúñü]|$)`, "i");
  return re.test(hayFolded);
}

/**
 * El término (ya sin tildes / minúsculas) como palabra completa en el texto plegado.
 * Evita p. ej. «pruebas» dentro de «compruebas». `_` cuenta como parte de palabra (identificadores).
 */
export function foldedTokenWholeWordMatch(hay: string, tokenFolded: string): boolean {
  if (tokenFolded.length < 2) return foldSpanishAccents(hay).includes(tokenFolded);
  const hayFolded = foldSpanishAccents(hay);
  const esc = tokenFolded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9áéíóúñü_])${esc}([^a-z0-9áéíóúñü_]|$)`, "i");
  return re.test(hayFolded);
}

/** Consultas de una sola palabra muy genéricas en QA; en hojas «Plataforma/Enlace» suelen ser ruido. */
const AMBIGUOUS_SINGLE_TOKEN_QA = new Set([
  "pruebas",
  "prueba",
  "testing",
  "regresion",
  "calidad",
  "qa",
  "uat",
]);

/** Si conviene re-filtrar en memoria (palabra larga o término QA ambiguo). */
export function librarySingleTokenNeedsRefinement(rawToken: string, tokenFolded: string): boolean {
  return rawToken.length >= 6 || AMBIGUOUS_SINGLE_TOKEN_QA.has(tokenFolded);
}

/**
 * Muchas filas tipo inventario Accenture (Plataforma + enlaces); no es el documento de «set de pruebas».
 */
export function credentialInventorySheetLikely(searchText: string | null | undefined): boolean {
  if (searchText == null || searchText.length < 400) return false;
  const plat = (searchText.match(/\bPlataforma:\s*/gi) ?? []).length;
  if (plat >= 4) return true;
  const enlaceProd = (searchText.match(/\bEnlace\s+Producci[oó]n:\s*/gi) ?? []).length;
  return enlaceProd >= 4;
}

/**
 * Con una palabra ambigua (p. ej. «pruebas»), no devolver solo coincidencias dentro de una hoja de credenciales
 * si el título/archivo/descripción no mencionan el término (evita mezclar con «Set de Pruebas»).
 */
export function librarySingleTokenCredentialNoise(
  tokenFolded: string,
  doc: { title: string; description: string | null; fileName: string | null; searchText: string | null }
): boolean {
  if (!AMBIGUOUS_SINGLE_TOKEN_QA.has(tokenFolded)) return false;
  if (!credentialInventorySheetLikely(doc.searchText)) return false;
  const meta = [doc.title, doc.description ?? "", doc.fileName ?? ""].join("\n");
  return !foldedTokenWholeWordMatch(meta, tokenFolded);
}

/** Si la consulta pide desarrollo, el host suele ser https://dev-… (no api-gateway ni cdn). */
const DEV_HTTP_HOST = /https?:\/\/dev[\w.-]+/i;

function entityMatchesDevUrlHint(segment: string, foldedTokens: string[]): boolean {
  for (const ft of foldedTokens) {
    if (SUBSTRING_MATCH_LEMMAS.has(ft) || ft === "enlace" || ft.length < 3) continue;
    const esc = ft.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`https?:\\/\\/dev[\\w.-]*${esc}|https?:\\/\\/dev-${esc}\\b`, "i").test(segment)) {
      return true;
    }
  }
  return false;
}

/**
 * Coincidencia fina: genéricos por subcadena; entidades solo como palabra completa tras quitar URLs.
 * Con «enlace» + «desarrollo»: exige URL con host dev… o coincidencia fuerte dev-{marca}, para no mezclar API Gateway/CDN.
 */
export function segmentMatchesCredentialSearchTokens(segment: string, foldedTokens: string[]): boolean {
  const fseg = foldSpanishAccents(stripUrlsForLibraryMatch(segment));
  const hasEnlace = foldedTokens.includes("enlace");
  const hasDesarrollo = foldedTokens.includes("desarrollo");
  const linkDevIntent = hasEnlace && hasDesarrollo;

  for (const ft of foldedTokens) {
    if (ft.length < 1) continue;
    if (linkDevIntent && (ft === "enlace" || ft === "desarrollo")) {
      continue;
    }
    if (ft === "enlace") {
      const hasUrl = /https?:\/\//i.test(segment);
      if (hasUrl || foldedWholeWordEntity(fseg, "enlace")) continue;
      return false;
    }
    if (SUBSTRING_MATCH_LEMMAS.has(ft)) {
      if (!fseg.includes(ft)) return false;
    } else if (!foldedWholeWordEntity(fseg, ft)) {
      return false;
    }
  }

  if (linkDevIntent) {
    if (!DEV_HTTP_HOST.test(segment)) return false;
    if (fseg.includes("desarrollo")) return true;
    return entityMatchesDevUrlHint(segment, foldedTokens);
  }

  return true;
}

function subSplitChunkBySitioLabels(chunk: string): string[] {
  let parts = [chunk];
  const splitters = [
    /(?=\n\s*Sitio\/Sistema:\s)/i,
    /(?=\n\s*Sitio:\s)/i,
    /(?=\n\s*Plataforma:\s)/i,
  ];
  for (const pat of splitters) {
    const next: string[] = [];
    for (const p of parts) {
      const sub = p.split(pat).map((c) => c.trim()).filter((c) => c.length > 0);
      next.push(...(sub.length > 1 ? sub : [p]));
    }
    parts = next;
  }
  return parts;
}

/**
 * Trocea por filas Excel indexadas: cada parte conserva el marcador `--- Fila N ---` al inicio
 * (excepto un posible preámbulo antes de la primera fila). Así el parser no mezcla columnas de filas distintas.
 */
function splitHaystackByFilaMarkers(trimmed: string): string[] | null {
  const re = /---\s*Fila\s+(\d+)\s*---/gi;
  const matches: { index: number; n: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    matches.push({ index: m.index, n: (m[1] ?? "").trim() || "?" });
  }
  if (matches.length === 0) return null;

  const chunks: string[] = [];
  const beforeFirst = trimmed.slice(0, matches[0]!.index).trim();
  if (beforeFirst.length > 0) {
    chunks.push(beforeFirst);
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index;
    const end = i + 1 < matches.length ? matches[i + 1]!.index : trimmed.length;
    chunks.push(trimmed.slice(start, end).trim());
  }
  return chunks.length > 0 ? chunks : null;
}

/** Si el índice cae dentro de un bloque `--- Fila N ---`, devuelve ese bloque completo. */
function expandToContainingFilaBlock(hay: string, hitIndex: number): { start: number; end: number } | null {
  const re = /^---\s*Fila\s+\d+\s*---/gim;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(hay)) !== null) {
    starts.push(m.index);
  }
  if (starts.length === 0) return null;
  if (hitIndex < starts[0]!) {
    return null;
  }
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k]!;
    const e = k + 1 < starts.length ? starts[k + 1]! : hay.length;
    if (hitIndex >= s && hitIndex < e) {
      return { start: s, end: e };
    }
  }
  const last = starts[starts.length - 1]!;
  if (hitIndex >= last) {
    return { start: last, end: hay.length };
  }
  return null;
}

/**
 * Parte texto tipo «Claves de acceso» exportado a texto: filas delimitadas por --- Fila N ---,
 * bloques Sitio/Sistema:, y sub-bloques por líneas «Sitio:» para no mezclar Toyota con Avalúo en el mismo segmento.
 */
export function splitLibraryTableSegments(hay: string): string[] {
  const trimmed = hay.trim();
  if (!trimmed) return [];

  let chunks: string[];
  const byFila = splitHaystackByFilaMarkers(trimmed);
  if (byFila != null && byFila.length > 1) {
    chunks = byFila;
  } else if (/Documentaci[oó]n\s+Accenture:/i.test(trimmed)) {
    const docBlocks = trimmed
      .split(/(?=Documentaci[oó]n\s+Accenture:\s*\d+)/gi)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    chunks = docBlocks.length > 1 ? docBlocks : [trimmed];
  } else if (/Plataforma:/i.test(trimmed)) {
    const plat = trimmed
      .split(/(?=Plataforma:)/gi)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    chunks = plat.length > 1 ? plat : [trimmed];
  } else if (/\bcredencial\s+\d+/i.test(trimmed)) {
    /* Antes que Sitio/Sistema: si no, todo lo previo al primer Sitio/Sistema queda en un solo segmento
     * enorme (Credencial 1…6) y el recorte por caracteres oculta Purdy Seguros en Credencial 7+. */
    chunks = trimmed
      .split(/(?=(?:^|[\n\r]+)\s*credencial\s+\d+\b)/gi)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (chunks.length <= 1) {
      chunks = trimmed
        .split(/\s+(?=\bcredencial\s+\d+\b)/gi)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
    }
    if (chunks.length <= 1) chunks = [trimmed];
  } else if (/Sitio\/Sistema:/i.test(trimmed)) {
    chunks = trimmed
      .split(/(?=Sitio\/Sistema:)/gi)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  } else {
    chunks = [trimmed];
  }

  const out: string[] = [];
  for (const ch of chunks) {
    out.push(...subSplitChunkBySitioLabels(ch));
  }
  return out.length > 0 ? out : [trimmed];
}

/** Prioriza documentos cuyo título contiene los términos como palabra (p. ej. «Set de Pruebas»). */
export function libraryHitTitleRelevance(title: string, tokens: string[]): number {
  const foldedTitle = foldSpanishAccents(title);
  let score = 0;
  for (const tok of tokens) {
    const ft = foldSpanishAccents(tok).replace(/[%_]/g, "");
    if (ft.length < 2) continue;
    if (foldedWholeWordEntity(foldedTitle, ft)) score += 14;
    else if (foldedTitle.includes(ft)) score += 4;
  }
  return score;
}

/**
 * True si algún segmento (fila/bloque) contiene todos los términos; útil para validar relevancia.
 */
export function libraryHaystackMatchesAllTokensInOneSegment(hay: string, tokens: string[]): boolean {
  const folded = tokens.map((t) => foldSpanishAccents(t)).filter((t) => t.length >= 1);
  if (folded.length < 2) return true;
  const segments = splitLibraryTableSegments(hay);
  return segments.some((seg) => segmentMatchesCredentialSearchTokens(seg, folded));
}

/** Bloques `--- Fila N ---` … del extracto Excel (texto íntegro). */
function extractFilaBlocksFromHaystack(hay: string): string[] {
  return hay
    .split(/(?=---\s*Fila\s+\d+\s*---)/gi)
    .map((c) => c.trim())
    .filter((c) => /^---\s*Fila\s+\d+\s*---/i.test(c));
}

/** Firma para enlazar un bloque Word «Plataforma» con una fila Excel «Sitio/Sistema». */
function segmentPlatformSignatures(seg: string): string[] {
  const sigs: string[] = [];
  const re = /(?:^|\n)\s*(Plataforma|Sitio\/Sistema|Sitio)\s*:\s*([^\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(seg)) !== null) {
    const v = (m[2] ?? "").trim();
    if (v.length < 3) continue;
    const f = foldSpanishAccents(v).replace(/\s+/g, " ").trim();
    if (f.length >= 6) sigs.push(f.slice(0, Math.min(72, f.length)));
  }
  return [...new Set(sigs)];
}

const FILA_EXTRA_LINE =
  /^\s*(Usuario|Contraseña|Contrasena|Ambiente|Uso|Referencia\/Base de datos|Url\/Endpoint|Sitio\/Sistema|Sitio)\s*:/i;

/**
 * El inventario Word suele traer «Plataforma» y enlaces; el Excel indexado trae la misma app en `Sitio/Sistema` + Usuario/Contraseña.
 * Sin mezclar todo el documento: solo enriquece segmentos que ya pasaron el filtro de búsqueda.
 * Elige la fila Excel cuya coincidencia con el nombre de plataforma/sitio sea la más larga (evita cruzar con otra marca).
 */
function enrichMatchedSegmentsWithFilaCredentials(hay: string, matched: string[]): string[] {
  const filaBlocks = extractFilaBlocksFromHaystack(hay);
  if (filaBlocks.length === 0) return matched;

  return matched.map((seg) => {
    if (/\b(usuario|contraseña|contrasena)\s*:/i.test(seg)) return seg;
    const sigs = segmentPlatformSignatures(seg);
    if (sigs.length === 0) return seg;

    const foldSeg = foldSpanishAccents(seg).replace(/\s+/g, " ");
    let bestExtra: string[] | null = null;
    let bestScore = 0;

    for (const block of filaBlocks) {
      if (!/\b(usuario|contraseña|contrasena)\s*:/i.test(block)) continue;
      const foldB = foldSpanishAccents(block).replace(/\s+/g, " ");
      let score = 0;
      for (const s of sigs) {
        if (s.length >= 6 && foldB.includes(s)) score = Math.max(score, s.length);
      }
      if (score < 6) continue;

      const extra: string[] = [];
      for (const line of block.split("\n")) {
        const t = line.trim();
        if (!t || !FILA_EXTRA_LINE.test(t)) continue;
        const fl = foldSpanishAccents(t).replace(/\s+/g, " ");
        if (!foldSeg.includes(fl)) extra.push(t);
      }
      if (extra.length === 0) continue;
      if (score > bestScore) {
        bestScore = score;
        bestExtra = extra;
      }
    }

    if (bestExtra != null && bestExtra.length > 0) {
      return `${seg.trim()}\n\n${bestExtra.join("\n")}`;
    }
    return seg;
  });
}

function joinSnippetBlocksFromSegments(matched: string[]): string {
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const seg of matched) {
    /* Conservar `--- Fila N ---` para delimitar filas Excel al formatear credenciales. */
    const cleaned = normalizeSnippetWhitespace(seg);
    if (/^credencial\s+\d+\s*$/i.test(cleaned)) continue;
    const key = foldSpanishAccents(cleaned).replace(/\s+/g, " ").slice(0, 2000);
    if (seen.has(key)) continue;
    seen.add(key);
    const fmt = formatSnippetForPresentation(cleaned, MULTI_ROW_SNIPPET_PER_SEGMENT);
    if (fmt.length > 0) blocks.push(fmt);
  }
  let joined = blocks.join("\n\n");
  if (joined.length > MULTI_ROW_SNIPPET_TOTAL) {
    joined = joined.slice(0, MULTI_ROW_SNIPPET_TOTAL).trimEnd() + "…";
  }
  return joined;
}

const DEV_URL_IN_LINE = /https?:\/\/dev[\w.-]+/i;
const NOISE_DEV_HOST = /api-gateway\.|cdn-api\.|\/\/gateway-toyotacr\.com/i;

/**
 * Si la consulta era enlace de desarrollo, deja solo Plataforma + línea(s) con «Enlace Desarrollo» o URL host dev…
 * (no toda la fila del inventario Accenture).
 */
export function narrowSnippetToDevEnlaceIntent(snippet: string, foldedTokens: string[]): string {
  const want = foldedTokens.includes("enlace") && foldedTokens.includes("desarrollo");
  if (!want) return snippet;

  const lines = snippet.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const l = raw.trim();
    if (!l) continue;
    const fold = foldSpanishAccents(l);
    if (/^plataforma\s*:/i.test(l)) {
      out.push(raw);
      continue;
    }
    if (/enlace\s+desarrollo\s*:/.test(fold) || /enlace\s+desarrollo:/i.test(l)) {
      out.push(raw);
      continue;
    }
    /* Texto extraído de Excel: nombre de plataforma (col. 2) y URL dev (col. 4 típ. «Adapt»). */
    if (/^columna\s+2\s*:/i.test(l)) {
      out.push(raw);
      continue;
    }
    if (/^columna\s+4\s*:/i.test(l) && DEV_URL_IN_LINE.test(l)) {
      out.push(raw);
      continue;
    }
    if (DEV_URL_IN_LINE.test(l) && !NOISE_DEV_HOST.test(l)) {
      out.push(raw);
      continue;
    }
  }
  return out.length > 0 ? out.join("\n") : snippet;
}

function narrowSnippetToProdEnlaceIntent(snippet: string, foldedTokens: string[]): string {
  const want =
    foldedTokens.includes("enlace") &&
    foldedTokens.includes("produccion") &&
    !foldedTokens.includes("desarrollo");
  if (!want) return snippet;

  const lines = snippet.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    const fold = foldSpanishAccents(l);
    if (/^plataforma\s*:/i.test(l)) {
      out.push(raw);
      continue;
    }
    if (/enlace\s+producc/.test(fold)) {
      out.push(raw);
      continue;
    }
    if (/^columna\s+2\s*:/i.test(l)) {
      out.push(raw);
      continue;
    }
    if (/^columna\s+3\s*:/i.test(l) && /https?:\/\//i.test(l) && !DEV_URL_IN_LINE.test(l)) {
      out.push(raw);
      continue;
    }
  }
  return out.length > 0 ? out.join("\n") : snippet;
}

/** Solo campos típicos de credenciales / acceso, no descripciones largas ni hosting. */
function narrowSnippetToCredentialIntent(snippet: string): string {
  const lines = snippet.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    const fold = foldSpanishAccents(l);
    if (/^---\s*fila\s+\d+\s*---$/i.test(fold)) {
      out.push(raw);
      continue;
    }
    if (/^plataforma\s*:/i.test(l) || /^sitio\/sistema\s*:/i.test(l) || /^sitio\s*:/i.test(l)) {
      out.push(raw);
      continue;
    }
    if (
      /^(usuario|contrasena|contras\b|clave|credencial|password|ambiente|uso|referencia\/|url\/endpoint|servicio|comentario|comentarios|dependencia|version|sub\s+dependencia|pertenece\s+a|repositorio|enlace\s+produccion|enlace\s+desarrollo|arquitectura|hospedaje|descripcion\s+de\s+plataforma|rama\s+de)\s*:/.test(
        fold
      )
    ) {
      out.push(raw);
      continue;
    }
    if (/^referencia\s*:/.test(fold) && !/^referencia\/base/i.test(fold)) {
      out.push(raw);
      continue;
    }
  }
  return out.length > 0 ? out.join("\n") : snippet;
}

function narrowSnippetToRepositorioIntent(snippet: string): string {
  const lines = snippet.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    const fold = foldSpanishAccents(l);
    if (/^plataforma\s*:/i.test(l)) {
      out.push(raw);
      continue;
    }
    if (/repositorio\s*:/.test(fold)) {
      out.push(raw);
      continue;
    }
    if (/dev\.azure\.com|gitlab\.grupopurdy|github\.com\/|dev\.azure/i.test(l)) {
      out.push(raw);
      continue;
    }
  }
  return out.length > 0 ? out.join("\n") : snippet;
}

/**
 * Recorta el fragmento a lo que encaja con la intención de la consulta (no toda la fila Excel).
 */
export function narrowSnippetByQueryTokens(snippet: string, foldedTokens: string[]): string {
  if (foldedTokens.includes("enlace") && foldedTokens.includes("desarrollo")) {
    return narrowSnippetToDevEnlaceIntent(snippet, foldedTokens);
  }
  if (foldedTokens.includes("enlace") && foldedTokens.includes("produccion") && !foldedTokens.includes("desarrollo")) {
    return narrowSnippetToProdEnlaceIntent(snippet, foldedTokens);
  }
  if (
    foldedTokens.some((t) =>
      ["contrasena", "clave", "credencial", "password", "usuario", "acceso"].includes(t)
    )
  ) {
    return narrowSnippetToCredentialIntent(snippet);
  }
  if (foldedTokens.includes("repositorio")) {
    return narrowSnippetToRepositorioIntent(snippet);
  }
  return snippet;
}

/** Texto tipo Excel «Credencial N / Plataforma:» donde conviene filtrar por bloque, no por ventana de caracteres. */
function libraryHaystackLooksCredentialSheetLike(hay: string, segments: string[]): boolean {
  if (segments.length > 1) return true;
  if (credentialInventorySheetLikely(hay)) return true;
  const head = hay.slice(0, Math.min(hay.length, 4000));
  if (/\bcredencial\s+\d+\b/i.test(head)) return true;
  const plat = (hay.match(/\bPlataforma:\s*/gi) ?? []).length;
  if (plat >= 2) return true;
  const filaMarkers = (hay.match(/---\s*Fila\s+\d+\s*---/gi) ?? []).length;
  const sitioSistema = (hay.match(/\bSitio\/Sistema:\s*/gi) ?? []).length;
  if (filaMarkers >= 2) return true;
  if (filaMarkers >= 1 && sitioSistema >= 1) return true;
  if (sitioSistema >= 2) return true;
  return false;
}

/**
 * Extracto legible alrededor de la primera coincidencia (términos sin acento matchean texto con acento).
 * Con 2+ términos, prioriza solo bloques/filas donde aparezcan todos (p. ej. «toyota» + «contraseña»).
 * Con 1 término en hoja tipo credenciales, solo bloques donde ese término aparece como palabra (p. ej. «avaluo» → Avalúo Digital, no toda la hoja).
 */
export function buildLibrarySearchSnippet(
  doc: { title: string; description: string | null; searchText: string | null },
  tokens: string[]
): string | null {
  const hay = [doc.searchText, doc.description, doc.title].filter(Boolean).join("\n");
  if (!hay) return null;
  const foldedTokens = tokens.map((t) => foldSpanishAccents(t)).filter((t) => t.length >= 1);
  if (foldedTokens.length === 0) return null;

  const foldHay = foldSpanishAccents(hay);
  const segments = splitLibraryTableSegments(hay);

  const snippetFromMatchedSegments = (): string | null => {
    let matched = segments.filter((seg) => segmentMatchesCredentialSearchTokens(seg, foldedTokens));
    if (matched.length === 0) return null;
    matched = enrichMatchedSegmentsWithFilaCredentials(hay, matched);
    const joined = joinSnippetBlocksFromSegments(matched);
    const narrowed = narrowSnippetByQueryTokens(joined, foldedTokens);
    return narrowed.trim().length > 0 ? narrowed : null;
  };

  if (tokens.length >= 2) {
    const fromSeg = snippetFromMatchedSegments();
    if (fromSeg !== null) return fromSeg;
  }

  if (tokens.length === 1 && libraryHaystackLooksCredentialSheetLike(hay, segments)) {
    const fromSeg = snippetFromMatchedSegments();
    if (fromSeg !== null) return fromSeg;
  }

  for (const t of tokens) {
    const ft = foldSpanishAccents(t);
    if (ft.length < 1) continue;
    const i = foldHay.indexOf(ft);
    if (i >= 0) {
      const bloque = expandToContainingFilaBlock(hay, i);
      if (bloque != null) {
        let slice = normalizeSnippetWhitespace(hay.slice(bloque.start, bloque.end));
        slice = formatSnippetForPresentation(slice, 14_000);
        return (bloque.start > 0 ? "…\n" : "") + slice + (bloque.end < hay.length ? "\n…" : "");
      }
      const start = Math.max(0, i - 200);
      const end = Math.min(hay.length, i + Math.max(t.length, ft.length) + 8000);
      let slice = normalizeSnippetWhitespace(hay.slice(start, end));
      slice = stripLibraryFilaMarkers(slice);
      slice = formatSnippetForPresentation(slice, 14_000);
      return (start > 0 ? "…\n" : "") + slice + (end < hay.length ? "\n…" : "");
    }
  }
  const headLen = Math.min(hay.length, 12_000);
  let head = normalizeSnippetWhitespace(stripLibraryFilaMarkers(hay.slice(0, headLen)));
  head = formatSnippetForPresentation(head, 12_000);
  return head + (hay.length > headLen ? "\n…" : "");
}

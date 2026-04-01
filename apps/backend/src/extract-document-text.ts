import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as XLSX from "xlsx";
import type { CellObject, WorkSheet } from "xlsx";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

/** Metadatos de figuras extraídas de Word (.docx) guardadas junto al archivo. */
export type ExtractedEmbeddedMedia = {
  fileName: string;
  contentType: string;
  relativePath: string;
};

function extForImageContentType(ct: string): string {
  const c = (ct || "").split(";")[0].trim().toLowerCase();
  if (c === "image/png") return "png";
  if (c === "image/jpeg" || c === "image/jpg") return "jpg";
  if (c === "image/gif") return "gif";
  if (c === "image/webp") return "webp";
  if (c === "image/bmp") return "bmp";
  if (c === "image/x-emf" || c === "image/emf") return "emf";
  return "bin";
}

/** Límite alto para indexar documentos largos (Word/Excel); SQLite TEXT lo admite. */
const MAX_INDEX_CHARS = 2_000_000;

/**
 * Unifica fin de línea (CRLF/CR → LF), limpia espacios al final de cada línea y evita trozos de PDF
 * partidos con guion al final de línea. Aplica a todo texto indexado (Word, PDF, Excel, CSV, TXT).
 */
function normalizeExtractedLineBreaks(text: string, opts?: { pdfHyphenJoin?: boolean }): string {
  let t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (opts?.pdfHyphenJoin) {
    t = t.replace(/([a-záéíóúñü])-\n([a-záéíóúñü])/gi, "$1$2");
  }
  t = t
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/[ \t]+/g, " "))
    .join("\n");
  t = t.replace(/\n{6,}/g, "\n\n\n\n\n");
  return t.trim();
}

/** Convierte HTML de mammoth (.docx) a texto con saltos de línea coherentes (párrafos, tablas, listas). */
function docxHtmlToPlain(html: string): string {
  let h = html.replace(/\r\n/g, "\n");
  h = h.replace(/<img\b[^>]*\bsrc="__DOCX_MEDIA__(\d+)__"[^>]*>/gi, (_, d) => {
    const n = Number.parseInt(String(d), 10) + 1;
    return `\n\n[Imagen ${n}]\n\n`;
  });
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(/<w:br\s*\/?>/gi, "\n");
  h = h.replace(/<hr\b[^>]*>/gi, "\n---\n");
  h = h.replace(/<\/(p|h[1-6]|div|section|article|blockquote|header|footer|main|aside|figure|figcaption|pre|address)\s*>/gi, "\n");
  h = h.replace(/<p\b[^>]*>/gi, "");
  h = h.replace(/<\/(caption|tr)\s*>/gi, "\n");
  h = h.replace(/<\/(table|thead|tbody|tfoot|ul|ol)\s*>/gi, "\n\n");
  h = h.replace(/<\/t[dh]\s*>/gi, "\n");
  h = h.replace(/<t[dh]\b[^>]*>/gi, "");
  h = h.replace(/<\/li\s*>/gi, "\n");
  h = h.replace(/<li\b[^>]*>/gi, "• ");
  h = h.replace(/<[^>]+>/g, " ");
  h = h.replace(/&nbsp;/gi, " ");
  h = h.replace(/&#160;/gi, " ");
  h = h.replace(/&amp;/gi, "&");
  h = h.replace(/&lt;/gi, "<");
  h = h.replace(/&gt;/gi, ">");
  h = h.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)));
  return normalizeExtractedLineBreaks(h, { pdfHyphenJoin: false });
}

/** Recupera saltos cuando Word/HTML dejó secciones o viñetas en una sola línea. */
function insertLikelyWordChecklistBreaks(text: string): string {
  return text
    .replace(/([^\n])\s+(✅\s*\d)/g, "$1\n\n$2")
    .replace(/([.!?])\s+(•\s)/g, "$1\n$2");
}

type SheetMerge = { s: { r: number; c: number }; e: { r: number; c: number } };

function cellObjectText(cell: CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w != null && String(cell.w).trim()) return String(cell.w).trim();
  if (cell.v != null && cell.v !== "") return String(cell.v).trim();
  return "";
}

/** Valor de celda respetando rangos fusionados (!merges): el valor vive en la esquina superior izquierda. */
function getSheetCellDisplay(sheet: WorkSheet, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  let cell = sheet[addr] as CellObject | undefined;
  if (cell) return cellObjectText(cell);
  const merges = sheet["!merges"] as SheetMerge[] | undefined;
  if (!merges?.length) return "";
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      const tl = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
      return cellObjectText(sheet[tl] as CellObject | undefined);
    }
  }
  return "";
}

function sheetMaxColumnIndex(sheet: WorkSheet, rows: (string | number | boolean | null | undefined)[][]): number {
  let m = 0;
  const ref = sheet["!ref"];
  if (ref) {
    try {
      const d = XLSX.utils.decode_range(ref);
      m = Math.max(m, d.e.c + 1);
    } catch {
      /* ignore */
    }
  }
  for (const row of rows) {
    m = Math.max(m, row?.length ?? 0);
  }
  return Math.max(m, 1);
}

const HEADER_LABEL_MAX_LEN = 500;

/**
 * Etiquetas por columna: texto en la fila de cabecera; si es URL o vacío (típico en plantillas Accenture),
 * usa filas superiores de la misma columna (cabeceras en varias filas / celdas combinadas).
 */
function buildColumnLabelsFromSheet(sheet: WorkSheet, headerIdx: number, maxCols: number): string[] {
  const labels: string[] = [];
  const rowLo = Math.max(0, headerIdx - 5);

  for (let c = 0; c < maxCols; c++) {
    const atHeader = getSheetCellDisplay(sheet, headerIdx, c);
    let label = "";

    if (atHeader && !/^https?:\/\//i.test(atHeader) && atHeader.length <= HEADER_LABEL_MAX_LEN) {
      label = atHeader;
    }

    if (!label) {
      const parts: string[] = [];
      for (let r = rowLo; r < headerIdx; r++) {
        const v = getSheetCellDisplay(sheet, r, c);
        if (!v || /^https?:\/\//i.test(v) || v.length > HEADER_LABEL_MAX_LEN) continue;
        if (parts[parts.length - 1] !== v) parts.push(v);
      }
      if (parts.length) label = parts.join(" — ");
    }

    if (!label) {
      for (let r = headerIdx - 1; r >= Math.max(0, headerIdx - 28); r--) {
        const up = getSheetCellDisplay(sheet, r, c);
        if (up && !/^https?:\/\//i.test(up) && up.length <= HEADER_LABEL_MAX_LEN) {
          label = up;
          break;
        }
      }
    }

    labels.push(label || `Columna ${c + 1}`);
  }
  return labels;
}

/**
 * Puntuación para elegir la fila de encabezados (usa valores ya resueltos, p. ej. merges).
 */
function scoreHeaderCells(cells: string[]): number {
  if (cells.length < 2) return -1_000;

  let score = Math.min(cells.length * 14, 140);
  let httpCells = 0;
  let veryLong = 0;
  for (const s of cells) {
    if (/^https?:\/\//i.test(s)) httpCells++;
    if (s.length > 130) veryLong++;
  }
  const httpRatio = httpCells / cells.length;
  if (httpRatio > 0.28) score -= 90;
  if (veryLong > Math.ceil(cells.length * 0.28)) score -= 45;

  /* Las filas de datos suelen incluir enlaces; la fila de títulos de columna casi nunca. */
  score -= httpCells * 40;
  if (httpCells === 0) score += 40;

  const avgLen = cells.reduce((a, s) => a + s.length, 0) / cells.length;
  if (avgLen < 48) score += 28;
  if (avgLen > 95) score -= 30;

  const joined = foldForHeaderScore(cells.join(" "));
  if (
    /plataforma|enlace|repositorio|arquitectura|hospedaje|descripcion\s+de\s+plataforma|rama\s+de/.test(joined)
  ) {
    score += 42;
  }

  return score;
}

function scoreHeaderRowFromSheet(sheet: WorkSheet, rowIndex: number, maxCols: number): number {
  const cells: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const v = getSheetCellDisplay(sheet, rowIndex, c);
    if (v) cells.push(v);
  }
  return scoreHeaderCells(cells);
}

function foldForHeaderScore(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Fila 1 (índice 0) con encabezados reales de tabla vs título/merged (p. ej. «Documentación Accenture»).
 * Si no califica, convención del negocio: encabezados en fila 3 (índice 2).
 */
function rowLooksLikeTableHeaders(sheet: WorkSheet, rowIdx: number, maxCol: number): boolean {
  const cellTexts: string[] = [];
  for (let c = 0; c < maxCol; c++) {
    const v = getSheetCellDisplay(sheet, rowIdx, c);
    if (v) cellTexts.push(v.trim());
  }
  if (cellTexts.length === 0) return false;

  const joined = foldForHeaderScore(cellTexts.join(" "));
  if (
    /sitio\/sistema|\busuario\b|\bcontrasena\b|\bambiente\b|hospedaje\s+produccion|repositorio|quien\s+lo\s+administra|rama\s+de(\s+produccion|\s+desarrollo)?|referencia\/base\s+de\s+datos|\buso\b|url\/endpoint|plataforma|enlace\s+produccion|enlace\s+desarrollo|tipo\b|descripcion\s+general|comentario/i.test(
      joined
    )
  ) {
    return true;
  }

  const distinct = new Set(cellTexts.map((t) => t.slice(0, 80)));
  const shortLabels = [...distinct].filter(
    (t) => t.length > 0 && t.length <= 72 && !/^https?:\/\//i.test(t)
  );
  if (shortLabels.length >= 3) return true;
  if (
    shortLabels.length >= 2 &&
    shortLabels.every((t) => t.length <= 48) &&
    cellTexts.filter((t) => !/^https?:\/\//i.test(t) && t.length <= 72).length >= 2
  ) {
    return true;
  }

  return false;
}

function pickHeaderRowIndexByScoring(
  sheet: WorkSheet,
  rows: (string | number | boolean | null | undefined)[][]
): number {
  const maxScan = Math.min(rows.length, 45);
  const maxCol = sheetMaxColumnIndex(sheet, rows);
  let best = 0;
  let bestScore = scoreHeaderRowFromSheet(sheet, 0, maxCol);
  for (let i = 1; i < maxScan; i++) {
    const sc = scoreHeaderRowFromSheet(sheet, i, maxCol);
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    } else if (sc === bestScore && sc >= 25 && i > best) {
      best = i;
    }
  }
  return best;
}

function pickHeaderRowIndex(
  sheet: WorkSheet,
  rows: (string | number | boolean | null | undefined)[][]
): number {
  const maxCol = sheetMaxColumnIndex(sheet, rows);
  if (rowLooksLikeTableHeaders(sheet, 0, maxCol)) return 0;
  if (rows.length > 2) return 2;
  return pickHeaderRowIndexByScoring(sheet, rows);
}

/**
 * Convierte una hoja Excel en texto legible (nombre de columna del encabezado real + filas separadas).
 */
function formatExcelSheetAsReadable(sheet: WorkSheet, sheetName: string): string {
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (!rows.length) return "";

  const headerIdx = pickHeaderRowIndex(sheet, rows);
  const maxCol = sheetMaxColumnIndex(sheet, rows);
  const headers = buildColumnLabelsFromSheet(sheet, headerIdx, maxCol);

  const blocks: string[] = [];
  blocks.push(`=== Hoja: ${sheetName} ===`);
  const headerLegend = headers
    .map((h) => (h ?? "").trim())
    .filter((h) => h.length > 0 && !/^columna\s+\d+$/i.test(h));
  if (headerLegend.length > 0) {
    blocks.push(`[Encabezados de la hoja: ${headerLegend.join(" · ")}]`);
  }

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const lines: string[] = [];
    for (let c = 0; c < maxCol; c++) {
      const rawVal = getSheetCellDisplay(sheet, r, c);
      if (!rawVal) continue;
      const val = rawVal.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const label = headers[c] ?? `Columna ${c + 1}`;
      lines.push(
        val.includes("\n")
          ? `${label}:\n${val
              .split(/\n/)
              .map((line) => `  ${line.replace(/[ \t]+$/g, "")}`)
              .join("\n")}`
          : `${label}: ${val}`
      );
    }
    if (lines.length > 0) {
      blocks.push(`\n--- Fila ${r + 1} ---\n${lines.join("\n\n")}`);
    }
  }

  return blocks.join("\n");
}

function noteIfTruncated(originalLen: number): string | undefined {
  return originalLen > MAX_INDEX_CHARS ? "Contenido truncado para indexación (límite de tamaño)." : undefined;
}

/**
 * Extrae texto plano de PDF, Word (.docx), Excel (.xlsx/.xls) o CSV/TXT para indexar la búsqueda.
 * No soporta Word .doc binario antiguo (convertir a .docx o PDF).
 * Con `docxMediaDir`, extrae imágenes incrustadas del .docx y deja marcadores `[Imagen N]` en el texto.
 */
export async function extractSearchableText(
  buffer: Buffer,
  mime: string,
  fileName: string,
  options?: { docxMediaDir?: string; cwd?: string }
): Promise<{ text: string; extractionNote?: string; embeddedMedia?: ExtractedEmbeddedMedia[] }> {
  const lower = fileName.toLowerCase();
  const mimeL = (mime || "").toLowerCase();

  if (lower.endsWith(".doc") && !lower.endsWith(".docx")) {
    throw new Error(
      "El formato .doc (Word antiguo) no está soportado. Guarde el archivo como .docx o PDF y vuelva a subirlo."
    );
  }

  if (mimeL.includes("pdf") || lower.endsWith(".pdf")) {
    const data = await pdfParse(buffer);
    const raw = normalizeExtractedLineBreaks((data.text || "").trim(), { pdfHyphenJoin: true });
    return {
      text: raw.slice(0, MAX_INDEX_CHARS),
      extractionNote: noteIfTruncated(raw.length),
    };
  }

  if (lower.endsWith(".docx") || mimeL.includes("wordprocessingml")) {
    const notes: string[] = [];
    const mediaDir = options?.docxMediaDir;
    const cwd = options?.cwd ?? process.cwd();

    if (mediaDir) {
      await fs.mkdir(mediaDir, { recursive: true });
      const saved: { fileName: string; contentType: string }[] = [];
      const conv = await mammoth.convertToHtml(
        { buffer },
        {
          ignoreEmptyParagraphs: false,
          convertImage: mammoth.images.imgElement(async (image) => {
            const imageBuf = await image.read();
            const ext = extForImageContentType(image.contentType);
            const fn = `img-${saved.length}.${ext}`;
            const full = path.join(mediaDir, fn);
            await fs.writeFile(full, imageBuf);
            const ct = (image.contentType || "image/png").split(";")[0].trim();
            saved.push({ fileName: fn, contentType: ct });
            const idx = saved.length - 1;
            return { src: `__DOCX_MEDIA__${idx}__` };
          }),
        }
      );
      if (conv.messages.length > 0) notes.push("Word: advertencias al convertir HTML.");
      let raw = docxHtmlToPlain(conv.value || "");
      raw = normalizeExtractedLineBreaks(insertLikelyWordChecklistBreaks(raw), { pdfHyphenJoin: false });
      const embeddedMedia: ExtractedEmbeddedMedia[] = saved.map((s) => ({
        fileName: s.fileName,
        contentType: s.contentType,
        relativePath: path.relative(cwd, path.join(mediaDir, s.fileName)).replace(/\\/g, "/"),
      }));
      if (saved.length > 0) {
        notes.push(`Word: ${saved.length} imagen(es) incrustada(s) extraída(s).`);
      }
      const trunc = noteIfTruncated(raw.length);
      if (trunc) notes.push(trunc);
      return {
        text: raw.slice(0, MAX_INDEX_CHARS),
        extractionNote: notes.length ? notes.join(" ") : undefined,
        embeddedMedia: embeddedMedia.length > 0 ? embeddedMedia : undefined,
      };
    }

    const conv = await mammoth.convertToHtml({ buffer }, { ignoreEmptyParagraphs: false });
    if (conv.messages.length > 0) notes.push("Word: advertencias al convertir HTML.");
    const fromHtml = docxHtmlToPlain(conv.value || "");
    const r = await mammoth.extractRawText({ buffer });
    if (r.messages.length > 0) notes.push("Word: advertencias al extraer texto plano.");
    const fromRaw = normalizeExtractedLineBreaks((r.value || "").trim(), { pdfHyphenJoin: false });

    const lineBreakScore = (t: string) => (t.match(/\n/g) ?? []).length;
    let raw: string;
    if (!fromHtml.trim()) {
      raw = fromRaw;
    } else if (fromRaw.length > 0 && lineBreakScore(fromRaw) > lineBreakScore(fromHtml)) {
      /* El árbol DOCX suele reflejar párrafos mejor que un único <p> plano en HTML. */
      raw = fromRaw;
    } else {
      raw = fromHtml;
    }
    raw = normalizeExtractedLineBreaks(insertLikelyWordChecklistBreaks(raw), { pdfHyphenJoin: false });
    const trunc = noteIfTruncated(raw.length);
    if (trunc) notes.push(trunc);
    return {
      text: raw.slice(0, MAX_INDEX_CHARS),
      extractionNote: notes.length ? notes.join(" ") : undefined,
    };
  }

  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mimeL.includes("spreadsheet") ||
    mimeL.includes("excel")
  ) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      if (!sheet) continue;
      parts.push(formatExcelSheetAsReadable(sheet, name));
    }
    const raw = normalizeExtractedLineBreaks(parts.join("\n\n").trim(), { pdfHyphenJoin: false });
    return {
      text: raw.slice(0, MAX_INDEX_CHARS),
      extractionNote: noteIfTruncated(raw.length),
    };
  }

  if (lower.endsWith(".csv") || mimeL.includes("csv")) {
    try {
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const firstName = wb.SheetNames[0];
      const sh = firstName ? wb.Sheets[firstName] : undefined;
      if (sh && firstName) {
        const formatted = formatExcelSheetAsReadable(sh, firstName).trim();
        if (formatted.length > 0) {
          const norm = normalizeExtractedLineBreaks(formatted, { pdfHyphenJoin: false });
          return {
            text: norm.slice(0, MAX_INDEX_CHARS),
            extractionNote: noteIfTruncated(norm.length),
          };
        }
      }
    } catch {
      /* seguir con texto plano */
    }
    const raw = normalizeExtractedLineBreaks(buffer.toString("utf8").trim(), { pdfHyphenJoin: false });
    return {
      text: raw.slice(0, MAX_INDEX_CHARS),
      extractionNote: noteIfTruncated(raw.length),
    };
  }

  if (lower.endsWith(".txt") || mimeL.startsWith("text/")) {
    const raw = normalizeExtractedLineBreaks(buffer.toString("utf8").trim(), { pdfHyphenJoin: false });
    return {
      text: raw.slice(0, MAX_INDEX_CHARS),
      extractionNote: noteIfTruncated(raw.length),
    };
  }

  throw new Error(
    `Formato no reconocido (${fileName}). Use PDF, Word .docx, Excel .xlsx/.xls, CSV o TXT.`
  );
}

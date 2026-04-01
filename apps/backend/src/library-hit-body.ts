import type { DocumentSearchHit } from "@domain-slayer/application";

/**
 * Cuerpo para asistente / resúmenes en servidor: prioriza el **snippet** (filtrado por la consulta).
 * El texto íntegro (`searchText`) solo si no hay fragmento, para no inundar con Toyota/Ford cuando se buscó «avalúo».
 * Las filas Excel (Usuario/Contraseña) se fusionan al fragmento en `buildLibrarySearchSnippet` cuando coinciden por nombre de plataforma/sitio.
 */
export function pickIndexedBodyForServer(hit: DocumentSearchHit, maxChars: number): string {
  const st = hit.document.searchText?.trim() ?? "";
  const sn = hit.snippet?.trim() ?? "";
  const body = sn.length > 0 ? sn : st;

  if (body.length > maxChars) {
    return `${body.slice(0, maxChars)}…`;
  }
  return body;
}

/** Si no había nada que guardar, no exigimos coincidencia en BD. */
export function notesMatchDb(sentTrimmed: string, fromDb: string | null | undefined): boolean {
  if (!sentTrimmed) return true;
  return (fromDb ?? "").trim() === sentTrimmed;
}

/**
 * Expresión SQL que iguala mayúsculas y quita tildes típicas del español para LIKE con términos ya normalizados (sin acento).
 * Compatible con SQLite y SQL Server (REPLACE anidado).
 */
export function spanishAccentFoldExpr(innerSql: string): string {
  const pairs: [string, string][] = [
    ["á", "a"],
    ["é", "e"],
    ["í", "i"],
    ["ó", "o"],
    ["ú", "u"],
    ["ü", "u"],
    ["ñ", "n"],
    ["Á", "a"],
    ["É", "e"],
    ["Í", "i"],
    ["Ó", "o"],
    ["Ú", "u"],
    ["Ü", "u"],
    ["Ñ", "n"],
  ];
  let e = `LOWER(${innerSql})`;
  for (const [from, to] of pairs) {
    e = `replace(${e}, '${from}', '${to}')`;
  }
  return e;
}

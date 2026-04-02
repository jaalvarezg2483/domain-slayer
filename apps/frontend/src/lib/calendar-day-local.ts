/**
 * Días de calendario entre dos instantes (solo la fecha, sin hora), según el calendario local del navegador.
 * Duplicado deliberado respecto a `@domain-slayer/shared`: el frontend no depende del build de ese paquete (Vite).
 */
export function calendarDayDiffLocal(from: Date, to: Date): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}

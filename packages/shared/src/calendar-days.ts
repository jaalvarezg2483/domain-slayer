/** Zona por defecto para vencimientos en servidor/correos (Costa Rica). Sobrescriba con `CALENDAR_TIME_ZONE`. */
export const DEFAULT_CALENDAR_TIME_ZONE = "America/Costa_Rica";

/**
 * Días de calendario entre dos instantes (solo fecha, sin hora), según el calendario local del entorno.
 * Evita el desfase típico UTC vs. «hoy» del usuario (p. ej. tarde en CR cuando en UTC ya es el día siguiente).
 */
export function calendarDayDiffLocal(from: Date, to: Date): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000);
}

/**
 * Igual que `calendarDayDiffLocal` pero usando el calendario en una zona IANA (p. ej. `America/Costa_Rica`).
 */
export function calendarDayDiffInTimeZone(from: Date, to: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const key = (d: Date) => fmt.format(d);
    const ordinal = (k: string) => {
      const [y, m, day] = k.split("-").map(Number);
      return Math.round(Date.UTC(y, m - 1, day) / 86_400_000);
    };
    return ordinal(key(to)) - ordinal(key(from));
  } catch {
    return calendarDayDiffLocal(from, to);
  }
}

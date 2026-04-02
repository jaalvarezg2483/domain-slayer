import type { ExpiryLine } from "./expiry-proximity";
import { formatListDate } from "./site-table-dates";
import type { SiteRow } from "../types";

export function expiryLineText(line: ExpiryLine, site: SiteRow): string {
  const iso =
    line.kind === "ssl" ? (site.sslValidToFinal ?? site.sslValidTo) : site.domainExpiryFinal;
  const label = line.kind === "ssl" ? "SSL" : "Dominio";
  const dateStr = formatListDate(iso);
  if (line.days < 0) return `${label} vencido`;
  if (line.days === 0) return `${label} vence hoy (${dateStr})`;
  return `${label} vence en ${line.days} día${line.days === 1 ? "" : "s"} (${dateStr})`;
}

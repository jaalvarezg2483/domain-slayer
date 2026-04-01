import type { SiteRow } from "../types";

export function formatListDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-ES", { dateStyle: "medium" });
}

export function sslExpiryCellClass(s: SiteRow): string {
  if (!s.sslValidTo) return "muted small";
  if (s.sslStatus === "expiring_soon") return "table-expiry table-expiry--warn";
  return "muted small";
}

export function domainExpiryCellClass(s: SiteRow): string {
  if (!s.domainExpiryFinal) return "muted small";
  if (s.domainExpiryStatus === "expiring_soon") return "table-expiry table-expiry--warn";
  return "muted small";
}

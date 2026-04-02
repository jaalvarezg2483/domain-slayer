import type { SiteRow } from "../types";
import { calendarDaysUntil, urgencyFromDays } from "./expiry-proximity";

export function formatListDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-ES", { dateStyle: "medium" });
}

export function sslExpiryCellClass(s: SiteRow): string {
  const iso = s.sslValidToFinal ?? s.sslValidTo;
  if (!iso) return "muted small";
  const days = calendarDaysUntil(iso);
  if (days === null) return "muted small";
  const u = urgencyFromDays(days);
  if (u === "red") return "table-expiry table-expiry--critical";
  if (u === "orange") return "table-expiry table-expiry--warn";
  return "muted small";
}

export function domainExpiryCellClass(s: SiteRow): string {
  if (!s.domainExpiryFinal) return "muted small";
  const days = calendarDaysUntil(s.domainExpiryFinal);
  if (days === null) return "muted small";
  const u = urgencyFromDays(days);
  if (u === "red") return "table-expiry table-expiry--critical";
  if (u === "orange") return "table-expiry table-expiry--warn";
  return "muted small";
}

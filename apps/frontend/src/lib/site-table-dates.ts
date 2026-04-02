import type { SiteRow } from "../types";
import { calendarDaysUntil, urgencyFromDays } from "./expiry-proximity";

export function formatListDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-ES", { dateStyle: "medium" });
}

/** Fecha/hora corta para tablas estrechas; `title` lleva el valor completo. */
export function formatDashboardLastCheck(iso: string | null | undefined): { text: string; title: string } {
  if (!iso) return { text: "—", title: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { text: "—", title: "" };
  const title = d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "medium" });
  const text = d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { text, title };
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

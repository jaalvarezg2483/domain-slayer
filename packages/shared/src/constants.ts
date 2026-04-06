/** Umbrales de alerta SSL y dominio (días) — configurable por env en producción */
export const DEFAULT_ALERT_DAY_THRESHOLDS = [60, 30, 15, 7, 1] as const;

/**
 * Días hasta vencimiento por debajo de este valor → alerta **crítica** (0–4 con valor 5).
 * Por encima → advertencia hasta aplicar otros criterios del evaluador.
 */
export const ALERT_EXPIRING_CRITICAL_MAX_DAYS = 5;

export const DOMAIN_EXPIRY_SOURCE = {
  AUTO: "auto",
  MANUAL: "manual",
  UNAVAILABLE: "unavailable",
} as const;

export type DomainExpirySource = (typeof DOMAIN_EXPIRY_SOURCE)[keyof typeof DOMAIN_EXPIRY_SOURCE];

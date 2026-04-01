/** Umbrales de alerta SSL y dominio (días) — configurable por env en producción */
export const DEFAULT_ALERT_DAY_THRESHOLDS = [60, 30, 15, 7, 1] as const;

/**
 * Si quedan menos de este número de días hasta el vencimiento (SSL o dominio), la alerta es **crítica**.
 * Ej.: con 3 → crítico solo con 0, 1 o 2 días; a 3 o más días es advertencia.
 */
export const ALERT_EXPIRING_CRITICAL_MAX_DAYS = 3;

export const DOMAIN_EXPIRY_SOURCE = {
  AUTO: "auto",
  MANUAL: "manual",
  UNAVAILABLE: "unavailable",
} as const;

export type DomainExpirySource = (typeof DOMAIN_EXPIRY_SOURCE)[keyof typeof DOMAIN_EXPIRY_SOURCE];

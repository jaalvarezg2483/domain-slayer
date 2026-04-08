import type { DomainExpirySource } from "@domain-slayer/domain";

/** Resultado de un chequeo agregado (puerto hacia el dominio de monitoreo) */
export interface MonitoringCheckResult {
  /** Fecha de expiración inferida solo si la fuente es confiable (p. ej. RDAP); si no, null */
  domainExpiryAuto: Date | null;
  /** Registrador detectado por RDAP/WHOIS; se puede persistir en sitio si no había uno manual */
  domainRegistrarDetected: string | null;
  domainExpirySource: DomainExpirySource;
  domainExpiryStatus: "ok" | "expiring_soon" | "expired" | "unknown";
  domainStatus: "ok" | "warning" | "error" | "unknown";

  dnsStatus: "ok" | "error" | "unknown";
  nameservers: string[];
  aRecords: string[];
  aaaaRecords: string[];
  cnameRecords: string[];
  mxRecords: string[];
  soaRecord: Record<string, string> | null;

  httpStatus: "ok" | "error" | "timeout" | "unknown";
  httpsStatus: "ok" | "error" | "timeout" | "unknown";
  /** Tras `GET` HTTPS con `redirect: follow` (misma lógica que el probe de conectividad). */
  httpsEffectiveUrl: string;

  sslSubject: string | null;
  sslIssuer: string | null;
  sslValidFrom: Date | null;
  sslValidTo: Date | null;
  sslSerialNumber: string | null;
  sslStatus: "valid" | "expiring_soon" | "expired" | "tls_error" | "hostname_mismatch" | "unknown";
  sslHostnameMatch: boolean | null;

  checkStatus: "success" | "partial" | "failed";
  healthStatus: "healthy" | "warning" | "critical" | "unknown";
  errorMessage: string | null;
  durationMs: number;
}

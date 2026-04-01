export type SiteEnvironment = "production" | "staging" | "development";

export type SslStatus =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "tls_error"
  | "hostname_mismatch"
  | "unknown";

export type DomainStatus = "ok" | "warning" | "error" | "unknown";

export type DnsStatus = "ok" | "error" | "unknown";

export type HttpCheckStatus = "ok" | "error" | "timeout" | "unknown";

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type CheckStatus = "success" | "partial" | "failed";

export type DomainExpiryStatus = "ok" | "expiring_soon" | "expired" | "unknown";

export type DocumentType =
  | "technical_manual"
  | "provider_data"
  | "payment_info"
  | "dns_data"
  | "contacts"
  | "observations"
  | "certificate"
  | "operational_notes"
  | "other";

export type AlertType =
  | "ssl_expiring"
  | "ssl_expired"
  | "ssl_error"
  | "domain_expiring"
  | "domain_unknown_expiry"
  | "domain_registry_differs_from_manual"
  | "dns_error"
  | "http_error"
  | "https_error";

export type AlertSeverity = "info" | "warning" | "critical";

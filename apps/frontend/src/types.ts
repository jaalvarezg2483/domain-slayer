export type SiteEnvironment = "production" | "staging" | "development";

export interface SiteRow {
  id: string;
  siteName: string;
  domain: string;
  url: string;
  environment: SiteEnvironment;
  healthStatus: string;
  sslStatus: string;
  /** Presente en listados API para resaltar urgencia */
  domainExpiryStatus?: string;
  domainExpiryFinal: string | null;
  sslValidTo: string | null;
  lastCheckedAt: string | null;
  isActive: boolean;
  /** Notas libres: URLs (prod, dev), accesos admin, etc. */
  notes?: string | null;
  /** Cómo resolver renovación/instalación SSL (editable en servidor). */
  sslResolutionNotes?: string | null;
  /** Cómo resolver dominio / pago (editable en servidor). */
  domainResolutionNotes?: string | null;
  /** Documentos de biblioteca enlazados (GET sitio completo). */
  linkedDocuments?: { id: string; title: string }[];
  /** Quién registró el dominio (p. ej. GoDaddy); viene del chequeo / RDAP */
  registrarProvider?: string | null;
  sslProvider?: string | null;
  /** Emisor del certificado (p. ej. Let's Encrypt, DigiCert) */
  sslIssuer?: string | null;
  dnsProvider?: string | null;
  hostingProvider?: string | null;
  contactEmail?: string | null;
  technicalOwner?: string | null;
  sslSubject?: string | null;
  sslSerialNumber?: string | null;
  sslValidFrom?: string | null;
}

export interface AlertRow {
  id: string;
  siteId: string;
  alertType: string;
  severity: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  isResolved: boolean;
}

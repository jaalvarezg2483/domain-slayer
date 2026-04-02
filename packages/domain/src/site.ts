import type {
  CheckStatus,
  DnsStatus,
  DomainExpiryStatus,
  DomainStatus,
  HealthStatus,
  HttpCheckStatus,
  SiteEnvironment,
  SslStatus,
} from "./enums.js";
import type { DomainExpirySource } from "./site-source.js";

export type { DomainExpirySource } from "./site-source.js";

export interface Site {
  id: string;
  siteName: string;
  businessUnit: string | null;
  domain: string;
  url: string;
  environment: SiteEnvironment;
  provider: string | null;
  hostingProvider: string | null;
  dnsProvider: string | null;
  sslProvider: string | null;
  registrarProvider: string | null;
  owner: string | null;
  technicalOwner: string | null;
  contactEmail: string | null;
  notes: string | null;
  /** Cómo renovar/instalar SSL (editable; datos del certificado vienen del chequeo). */
  sslResolutionNotes: string | null;
  /** Cómo renovar/pagar dominio (editable). */
  domainResolutionNotes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  domainExpiryAuto: Date | null;
  domainExpiryManual: Date | null;
  domainExpiryFinal: Date | null;
  domainExpirySource: DomainExpirySource;
  domainExpiryStatus: DomainExpiryStatus;
  domainStatus: DomainStatus;

  dnsStatus: DnsStatus;
  nameserversJson: string | null;
  aRecordsJson: string | null;
  aaaaRecordsJson: string | null;
  cnameRecordsJson: string | null;
  mxRecordsJson: string | null;
  soaRecordJson: string | null;

  httpStatus: HttpCheckStatus;
  httpsStatus: HttpCheckStatus;

  sslSubject: string | null;
  sslIssuer: string | null;
  sslValidFrom: Date | null;
  /** Fin de validez según el último chequeo TLS (automático). */
  sslValidTo: Date | null;
  /** Fecha manual si el chequeo no obtiene el certificado; prevalece según `sslExpirySource`. */
  sslValidToManual: Date | null;
  sslExpirySource: DomainExpirySource;
  /** Fecha efectiva para listados, alertas y panel (manual o automática). */
  sslValidToFinal: Date | null;
  sslSerialNumber: string | null;
  sslStatus: SslStatus;
  sslHostnameMatch: boolean | null;

  lastCheckedAt: Date | null;
  checkStatus: CheckStatus;
  healthStatus: HealthStatus;
  /**
   * Documentos de la biblioteca vinculados a este sitio (mismo manual puede enlazarse desde varios sitios).
   * Solo se rellena en GET /sites/:id.
   */
  linkedDocuments?: SiteLinkedDocumentRef[];
}

export interface SiteLinkedDocumentRef {
  id: string;
  title: string;
}

export type SiteCreateInput = Omit<
  Site,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "domainExpiryAuto"
  | "domainExpiryFinal"
  | "domainExpiryStatus"
  | "domainStatus"
  | "dnsStatus"
  | "nameserversJson"
  | "aRecordsJson"
  | "aaaaRecordsJson"
  | "cnameRecordsJson"
  | "mxRecordsJson"
  | "soaRecordJson"
  | "httpStatus"
  | "httpsStatus"
  | "sslSubject"
  | "sslIssuer"
  | "sslValidFrom"
  | "sslValidTo"
  | "sslValidToManual"
  | "sslValidToFinal"
  | "sslExpirySource"
  | "sslSerialNumber"
  | "sslStatus"
  | "sslHostnameMatch"
  | "lastCheckedAt"
  | "checkStatus"
  | "healthStatus"
  | "sslResolutionNotes"
  | "domainResolutionNotes"
  | "linkedDocuments"
> & {
  domainExpiryManual?: Date | null;
  domainExpirySource?: DomainExpirySource;
  sslValidToManual?: Date | null;
  /** Si no se envía, se infiere como `manual` si hay fecha manual, si no `unavailable`. */
  sslExpirySource?: DomainExpirySource;
};

export type SiteUpdateInput = Partial<
  Pick<
    Site,
    | "siteName"
    | "businessUnit"
    | "domain"
    | "url"
    | "environment"
    | "provider"
    | "hostingProvider"
    | "dnsProvider"
    | "sslProvider"
    | "registrarProvider"
    | "owner"
    | "technicalOwner"
    | "contactEmail"
    | "notes"
    | "sslResolutionNotes"
    | "domainResolutionNotes"
    | "isActive"
    | "domainExpiryManual"
    | "domainExpirySource"
    | "sslValidToManual"
    | "sslExpirySource"
  >
>;

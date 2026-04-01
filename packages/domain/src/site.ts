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
  sslValidTo: Date | null;
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
  >
>;

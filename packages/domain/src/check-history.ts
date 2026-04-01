import type {
  DnsStatus,
  DomainExpiryStatus,
  DomainStatus,
  HttpCheckStatus,
  SslStatus,
} from "./enums.js";
import type { DomainExpirySource } from "./site-source.js";

export interface CheckHistoryEntry {
  id: string;
  siteId: string;
  checkedAt: Date;
  domainStatus: DomainStatus;
  domainExpiryAuto: Date | null;
  domainExpirySource: DomainExpirySource;
  domainExpiryStatus: DomainExpiryStatus;
  dnsStatus: DnsStatus;
  httpStatus: HttpCheckStatus;
  httpsStatus: HttpCheckStatus;
  sslStatus: SslStatus;
  sslValidFrom: Date | null;
  sslValidTo: Date | null;
  sslIssuer: string | null;
  sslSubject: string | null;
  sslHostnameMatch: boolean | null;
  errorMessage: string | null;
  rawResultJson: string | null;
  durationMs: number;
}

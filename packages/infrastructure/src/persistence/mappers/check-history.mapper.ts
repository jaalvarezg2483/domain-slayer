import type { CheckHistoryEntry } from "@domain-slayer/domain";
import type { CheckHistoryEntity } from "../entities/check-history.entity.js";

export function mapCheckHistoryEntityToDomain(e: CheckHistoryEntity): CheckHistoryEntry {
  return {
    id: e.id,
    siteId: e.siteId,
    checkedAt: e.checkedAt,
    domainStatus: e.domainStatus as CheckHistoryEntry["domainStatus"],
    domainExpiryAuto: e.domainExpiryAuto,
    domainExpirySource: e.domainExpirySource as CheckHistoryEntry["domainExpirySource"],
    domainExpiryStatus: e.domainExpiryStatus as CheckHistoryEntry["domainExpiryStatus"],
    dnsStatus: e.dnsStatus as CheckHistoryEntry["dnsStatus"],
    httpStatus: e.httpStatus as CheckHistoryEntry["httpStatus"],
    httpsStatus: e.httpsStatus as CheckHistoryEntry["httpsStatus"],
    sslStatus: e.sslStatus as CheckHistoryEntry["sslStatus"],
    sslValidFrom: e.sslValidFrom,
    sslValidTo: e.sslValidTo,
    sslIssuer: e.sslIssuer,
    sslSubject: e.sslSubject,
    sslHostnameMatch: e.sslHostnameMatch,
    errorMessage: e.errorMessage,
    rawResultJson: e.rawResultJson,
    durationMs: e.durationMs,
  };
}

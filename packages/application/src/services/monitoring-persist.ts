import type { Site } from "@domain-slayer/domain";
import type { MonitoringCheckResult } from "../monitoring/types.js";
import type { SiteRepository } from "../ports/site-repository.js";
import { computeDomainExpiryFinal } from "./site-domain-expiry.js";
import { computeSslExpiryFinal } from "./site-ssl-expiry.js";
import { httpsHostUnderInventoryDomain } from "./site-registrable-domain.js";

/** Misma «ubicación» HTTPS (host, ruta y query) salvo barra final opcional. */
function sameHttpsLocation(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    if (ua.protocol !== ub.protocol) return false;
    if (ua.hostname.toLowerCase() !== ub.hostname.toLowerCase()) return false;
    const pa = ua.pathname.replace(/\/+$/, "") || "/";
    const pb = ub.pathname.replace(/\/+$/, "") || "/";
    return pa === pb && ua.search === ub.search;
  } catch {
    return a.trim() === b.trim();
  }
}

export function monitoringResultToOperationalPatch(
  site: Site,
  result: MonitoringCheckResult
): Parameters<SiteRepository["updateOperationalFields"]>[1] {
  let source = site.domainExpirySource;
  if (!site.domainExpiryManual && result.domainExpiryAuto && result.domainExpirySource === "auto") {
    source = "auto";
  }
  const domainExpiryFinal = computeDomainExpiryFinal(result.domainExpiryAuto, site.domainExpiryManual, source);

  let sslSource = site.sslExpirySource;
  if (
    !site.sslValidToManual &&
    result.sslValidTo &&
    result.sslStatus !== "tls_error" &&
    result.sslStatus !== "hostname_mismatch"
  ) {
    sslSource = "auto";
  }
  const sslValidToFinal = computeSslExpiryFinal(result.sslValidTo, site.sslValidToManual, sslSource);

  const registrarProvider =
    !site.registrarProvider?.trim() && result.domainRegistrarDetected?.trim()
      ? result.domainRegistrarDetected.trim()
      : undefined;

  let url: string | undefined;
  if (result.httpsStatus === "ok" && result.httpsEffectiveUrl?.trim()) {
    try {
      const eff = new URL(result.httpsEffectiveUrl);
      if (httpsHostUnderInventoryDomain(eff.hostname, site.domain)) {
        if (!sameHttpsLocation(site.url, result.httpsEffectiveUrl)) {
          url = result.httpsEffectiveUrl;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return {
    domainExpiryAuto: result.domainExpiryAuto,
    domainExpirySource: source,
    domainExpiryFinal,
    domainExpiryStatus: result.domainExpiryStatus as Site["domainExpiryStatus"],
    ...(registrarProvider !== undefined ? { registrarProvider } : {}),
    domainStatus: result.domainStatus as Site["domainStatus"],
    dnsStatus: result.dnsStatus as Site["dnsStatus"],
    nameserversJson: JSON.stringify(result.nameservers),
    aRecordsJson: JSON.stringify(result.aRecords),
    aaaaRecordsJson: JSON.stringify(result.aaaaRecords),
    cnameRecordsJson: JSON.stringify(result.cnameRecords),
    mxRecordsJson: JSON.stringify(result.mxRecords),
    soaRecordJson: result.soaRecord ? JSON.stringify(result.soaRecord) : null,
    httpStatus: result.httpStatus as Site["httpStatus"],
    httpsStatus: result.httpsStatus as Site["httpsStatus"],
    sslSubject: result.sslSubject,
    sslIssuer: result.sslIssuer,
    sslValidFrom: result.sslValidFrom,
    sslValidTo: result.sslValidTo,
    sslExpirySource: sslSource,
    sslValidToFinal,
    sslSerialNumber: result.sslSerialNumber,
    sslStatus: result.sslStatus as Site["sslStatus"],
    sslHostnameMatch: result.sslHostnameMatch,
    lastCheckedAt: new Date(),
    checkStatus: result.checkStatus as Site["checkStatus"],
    healthStatus: result.healthStatus as Site["healthStatus"],
    ...(url !== undefined ? { url } : {}),
  };
}

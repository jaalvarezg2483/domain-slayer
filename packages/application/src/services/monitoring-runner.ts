import type { Site } from "@domain-slayer/domain";
import {
  calendarDayDiffInTimeZone,
  DEFAULT_ALERT_DAY_THRESHOLDS,
  DEFAULT_CALENDAR_TIME_ZONE,
} from "@domain-slayer/shared";
import type { MonitoringCheckResult } from "../monitoring/types.js";
import type {
  DnsInspector,
  DomainExpiryProvider,
  HttpConnectivityProbe,
  SslInspectionResult,
  SslInspector,
} from "../ports/monitoring.js";
import { computeDomainExpiryFinal, resolveDomainExpirySource } from "./site-domain-expiry.js";
import { computeSslExpiryFinal, resolveSslExpirySource } from "./site-ssl-expiry.js";
import { tlsHostnameAfterRedirect } from "./site-registrable-domain.js";

function monitoringCalendarTz(): string {
  const z = process.env.CALENDAR_TIME_ZONE?.trim();
  return z || DEFAULT_CALENDAR_TIME_ZONE;
}

/** Días de calendario en la zona configurada (p. ej. Costa Rica), no franjas de 24 h desde ahora. */
function calendarDaysUntil(from: Date, to: Date): number {
  return calendarDayDiffInTimeZone(from, to, monitoringCalendarTz());
}

function sslStatusToHealth(
  ssl: MonitoringCheckResult["sslStatus"],
  sslDays: number | null
): MonitoringCheckResult["healthStatus"] {
  if (ssl === "expired" || ssl === "tls_error" || ssl === "hostname_mismatch") return "critical";
  if (ssl === "expiring_soon" || (sslDays !== null && sslDays <= 30)) return "warning";
  if (ssl === "valid") return "healthy";
  return "unknown";
}

export interface MonitoringRunnerDeps {
  ssl: SslInspector;
  dns: DnsInspector;
  http: HttpConnectivityProbe;
  domainExpiry: DomainExpiryProvider;
  sslAlertDays: readonly number[];
  now?: () => Date;
}

export class MonitoringRunner {
  constructor(private readonly deps: MonitoringRunnerDeps) {}

  async run(site: Site): Promise<MonitoringCheckResult> {
    const started = Date.now();
    const now = this.deps.now?.() ?? new Date();
    const urlHost = extractHost(site.url, site.domain);
    const thresholds = this.deps.sslAlertDays.length ? this.deps.sslAlertDays : [...DEFAULT_ALERT_DAY_THRESHOLDS];

    const httpResult = await this.deps.http.probe(site.url, 8000);
    /** Certificado = solo el host de la URL HTTPS **final** del probe (redirecciones incluidas), sin sustituir por otro subdominio. */
    const sslResult = await inspectTlsForEffectiveHttpsUrl(
      this.deps.ssl,
      site.domain,
      urlHost,
      httpResult.httpsEffectiveUrl
    );
    const dnsResult = await this.deps.dns.inspect(site.domain);
    const domainProbe = await this.deps.domainExpiry.probe(site.domain);

    let domainExpiryAuto: Date | null = domainProbe.expiry;
    const gotAutoExpiry =
      !!domainExpiryAuto && (domainProbe.source === "rdap" || domainProbe.source === "whois");
    let domainExpirySource: MonitoringCheckResult["domainExpirySource"] = gotAutoExpiry ? "auto" : "unavailable";

    if (!domainExpiryAuto) {
      domainExpiryAuto = null;
      domainExpirySource = "unavailable";
    }

    const domainRegistrarDetected = domainProbe.registrar?.trim() || null;

    const finalExpiry = computeDomainExpiryFinal(
      domainExpiryAuto,
      site.domainExpiryManual,
      resolveDomainExpirySource(site.domainExpiryManual, site.domainExpirySource)
    );

    let domainExpiryStatus: MonitoringCheckResult["domainExpiryStatus"] = "unknown";
    if (finalExpiry) {
      const d = calendarDaysUntil(now, finalExpiry);
      if (d < 0) domainExpiryStatus = "expired";
      else if (thresholds.some((t) => d <= t && d >= 0)) domainExpiryStatus = "expiring_soon";
      else domainExpiryStatus = "ok";
    } else {
      domainExpiryStatus = "unknown";
    }

    const sslSourceForFinal = resolveSslExpirySource(site.sslValidToManual, site.sslExpirySource);
    const sslFinalDate = computeSslExpiryFinal(sslResult.validTo, site.sslValidToManual, sslSourceForFinal);

    let sslStatus = sslResult.status;
    if (sslResult.status === "hostname_mismatch") {
      /* sin cambio: el certificado no corresponde al host */
    } else if (sslFinalDate) {
      const sslDays = calendarDaysUntil(now, sslFinalDate);
      if (sslDays < 0) sslStatus = "expired";
      else if (thresholds.some((t) => sslDays <= t && sslDays >= 0)) sslStatus = "expiring_soon";
      else sslStatus = "valid";
    }

    const dnsStatus: MonitoringCheckResult["dnsStatus"] =
      dnsResult.status === "ok" ? "ok" : dnsResult.status === "error" ? "error" : "unknown";

    const domainStatus: MonitoringCheckResult["domainStatus"] =
      domainExpiryStatus === "expired" || dnsStatus === "error"
        ? "error"
        : domainExpiryStatus === "expiring_soon" || sslStatus === "expiring_soon"
          ? "warning"
          : "ok";

    let checkStatus: MonitoringCheckResult["checkStatus"] = "success";
    if (sslStatus === "tls_error" || sslStatus === "expired" || sslStatus === "hostname_mismatch") {
      checkStatus = "failed";
    } else if (sslResult.errorMessage || dnsResult.status === "error") {
      checkStatus = "partial";
    }

    const healthStatus = sslStatusToHealth(
      sslStatus,
      sslFinalDate ? calendarDaysUntil(now, sslFinalDate) : null
    );

    const errParts = [sslResult.errorMessage, dnsResult.errorMessage].filter(Boolean);
    const errorMessage = errParts.length ? errParts.join(" | ") : null;

    const durationMs = Date.now() - started;

    return {
      domainExpiryAuto,
      domainRegistrarDetected,
      domainExpirySource,
      domainExpiryStatus,
      domainStatus,
      dnsStatus,
      nameservers: dnsResult.nameservers,
      aRecords: dnsResult.aRecords,
      aaaaRecords: dnsResult.aaaaRecords,
      cnameRecords: dnsResult.cnameRecords,
      mxRecords: dnsResult.mxRecords,
      soaRecord: dnsResult.soa,
      httpStatus: httpResult.httpStatus,
      httpsStatus: httpResult.httpsStatus,
      httpsEffectiveUrl: httpResult.httpsEffectiveUrl,
      sslSubject: sslResult.subject,
      sslIssuer: sslResult.issuer,
      sslValidFrom: sslResult.validFrom,
      sslValidTo: sslResult.validTo,
      sslSerialNumber: sslResult.serialNumber,
      sslStatus,
      sslHostnameMatch: sslResult.hostnameMatch,
      checkStatus: checkStatus === "failed" ? "failed" : checkStatus,
      healthStatus,
      errorMessage,
      durationMs,
    };
  }
}

function extractHost(url: string, fallbackDomain: string): string {
  try {
    const u = new URL(url);
    return u.hostname || fallbackDomain;
  } catch {
    return fallbackDomain;
  }
}

/**
 * TLS al mismo host que la URL HTTPS final del probe (tras redirecciones). Si el sitio redirige apex → `www`, esa es la ruta.
 */
async function inspectTlsForEffectiveHttpsUrl(
  ssl: SslInspector,
  siteDomain: string,
  urlHostname: string,
  httpsEffectiveUrl: string
): Promise<SslInspectionResult> {
  const tlsHost = tlsHostnameAfterRedirect(siteDomain, urlHostname, httpsEffectiveUrl);
  const host = tlsHost.trim().toLowerCase().replace(/\.$/, "");

  async function inspectWithV4Fallback(h: string): Promise<SslInspectionResult> {
    let r = await ssl.inspectTls(h, 443, h);
    if (r.status === "tls_error") {
      r = await ssl.inspectTls(h, 443, h, { dnsFamily: 4 });
    }
    return r;
  }

  return inspectWithV4Fallback(host);
}

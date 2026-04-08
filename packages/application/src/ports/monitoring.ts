import type { HttpCheckStatus, SslStatus } from "@domain-slayer/domain";

/** Resultado inspección TLS */
export interface SslInspectionResult {
  subject: string | null;
  issuer: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  serialNumber: string | null;
  hostnameMatch: boolean | null;
  status: SslStatus;
  errorMessage: string | null;
}

export type SslInspectTlsOptions = {
  /** Forzar familia al resolver el host (p. ej. `4` si IPv6 elige un origen distinto o falla el handshake a `www`). */
  dnsFamily?: 4 | 6;
};

export interface SslInspector {
  inspectTls(
    hostname: string,
    port?: number,
    sniHostname?: string,
    options?: SslInspectTlsOptions
  ): Promise<SslInspectionResult>;
}

export interface DnsInspectionResult {
  nameservers: string[];
  aRecords: string[];
  aaaaRecords: string[];
  cnameRecords: string[];
  mxRecords: string[];
  soa: Record<string, string> | null;
  status: "ok" | "error" | "unknown";
  errorMessage: string | null;
}

export interface DnsInspector {
  inspect(domain: string): Promise<DnsInspectionResult>;
}

export interface DomainExpiryProbeResult {
  expiry: Date | null;
  /** Nombre del registrador si consta en RDAP/WHOIS (p. ej. GoDaddy.com, LLC) */
  registrar: string | null;
  source: "rdap" | "whois" | "unavailable";
}

export interface DomainExpiryProvider {
  probe(domain: string): Promise<DomainExpiryProbeResult>;
}

export interface HttpProbeResult {
  httpOk: boolean;
  httpsOk: boolean;
  httpStatus: HttpCheckStatus;
  httpsStatus: HttpCheckStatus;
  /** URL HTTPS tras seguir redirecciones (misma que la pedida si no hay 30x). Sirve para alinear TLS con el host real. */
  httpsEffectiveUrl: string;
}

export interface HttpConnectivityProbe {
  probe(url: string, timeoutMs: number): Promise<HttpProbeResult>;
}

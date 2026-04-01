import tls from "node:tls";
import type { SslInspectionResult, SslInspector } from "@domain-slayer/application";

function parseCertDates(cert: tls.DetailedPeerCertificate): { from: Date | null; to: Date | null } {
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
  const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
  return { from: validFrom, to: validTo };
}

function certSubject(cert: tls.DetailedPeerCertificate): string | null {
  if (cert.subject?.CN) return String(cert.subject.CN);
  return cert.subject ? JSON.stringify(cert.subject) : null;
}

function certIssuer(cert: tls.DetailedPeerCertificate): string | null {
  if (cert.issuer?.CN) return String(cert.issuer.CN);
  return cert.issuer ? JSON.stringify(cert.issuer) : null;
}

function hostnameMatchesCert(host: string, cert: tls.DetailedPeerCertificate): boolean {
  const lower = host.toLowerCase();
  const sans = cert.subjectaltname?.split(", ").map((s) => s.replace(/^DNS:/i, "").toLowerCase()) ?? [];
  if (sans.some((s) => s === lower || (s.startsWith("*.") && lower.endsWith(s.slice(1))))) return true;
  const cn = cert.subject?.CN ? String(cert.subject.CN).toLowerCase() : "";
  if (cn && (cn === lower || (cn.startsWith("*.") && lower.endsWith(cn.slice(1))))) return true;
  return false;
}

export class SslInspectorNode implements SslInspector {
  constructor(private readonly timeoutMs: number) {}

  inspectTls(hostname: string, port = 443, sniHostname?: string): Promise<SslInspectionResult> {
    const servername = sniHostname ?? hostname;
    return new Promise((resolve) => {
      const socket = tls.connect({
        host: hostname,
        port,
        servername,
        rejectUnauthorized: false,
      });
      const done = (r: SslInspectionResult) => {
        clearTimeout(timer);
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve(r);
      };
      const timer = setTimeout(() => {
        done({
          subject: null,
          issuer: null,
          validFrom: null,
          validTo: null,
          serialNumber: null,
          hostnameMatch: null,
          status: "tls_error",
          errorMessage: `Timeout TLS tras ${this.timeoutMs}ms`,
        });
      }, this.timeoutMs);

      socket.on("error", (err) => {
        done({
          subject: null,
          issuer: null,
          validFrom: null,
          validTo: null,
          serialNumber: null,
          hostnameMatch: null,
          status: "tls_error",
          errorMessage: err.message,
        });
      });

      socket.on("secureConnect", () => {
        let cert = socket.getPeerCertificate(true) as tls.DetailedPeerCertificate;
        if (!cert || Object.keys(cert).length === 0) {
          done({
            subject: null,
            issuer: null,
            validFrom: null,
            validTo: null,
            serialNumber: null,
            hostnameMatch: null,
            status: "tls_error",
            errorMessage: "Sin certificado peer",
          });
          return;
        }
        const { from, to } = parseCertDates(cert);
        const match = hostnameMatchesCert(servername, cert);
        const serial = cert.serialNumber ? String(cert.serialNumber) : null;
        const status = match ? "valid" : "hostname_mismatch";
        done({
          subject: certSubject(cert),
          issuer: certIssuer(cert),
          validFrom: from,
          validTo: to,
          serialNumber: serial,
          hostnameMatch: match,
          status,
          errorMessage: match ? null : "El certificado no coincide con el hostname esperado",
        });
      });
    });
  }
}

import dns from "node:dns";
import tls from "node:tls";
import type { SslInspectionResult, SslInspector, SslInspectTlsOptions } from "@domain-slayer/application";

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

/** Cadena emisor ← hoja (Node enlaza issuerCertificate; corta ciclos). */
function collectCertificateChain(peer: tls.DetailedPeerCertificate): tls.DetailedPeerCertificate[] {
  const chain: tls.DetailedPeerCertificate[] = [];
  let current: tls.DetailedPeerCertificate | undefined = peer;
  const seen = new WeakSet<tls.DetailedPeerCertificate>();
  while (current && Object.keys(current).length > 0) {
    if (seen.has(current)) break;
    seen.add(current);
    chain.push(current);
    const issuer = current.issuerCertificate as tls.DetailedPeerCertificate | undefined;
    if (!issuer || issuer === current) break;
    current = issuer;
  }
  return chain;
}

/**
 * Certificado que realmente identifica al servicio para el SNI: entre los de la cadena que coinciden con el
 * hostname, se elige el que **antes** vence (normalmente el leaf). Así no usamos por error un intermedio
 * con `notAfter` más lejano que el del sitio (caso que desvirtúa alertas frente al navegador).
 */
function pickServiceCertificate(peer: tls.DetailedPeerCertificate, servername: string): tls.DetailedPeerCertificate {
  const chain = collectCertificateChain(peer);
  const matching = chain.filter((c) => hostnameMatchesCert(servername, c));
  if (matching.length === 0) return peer;
  return matching.reduce((a, b) => {
    const ta = parseCertDates(a).to?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = parseCertDates(b).to?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return tb < ta ? b : a;
  });
}

export class SslInspectorNode implements SslInspector {
  constructor(private readonly timeoutMs: number) {}

  inspectTls(
    hostname: string,
    port = 443,
    sniHostname?: string,
    options?: SslInspectTlsOptions
  ): Promise<SslInspectionResult> {
    const servername = sniHostname ?? hostname;
    return new Promise((resolve) => {
      const connectOpts: tls.ConnectionOptions = {
        host: hostname,
        port,
        servername,
        rejectUnauthorized: false,
      };
      const fam = options?.dnsFamily;
      if (fam === 4 || fam === 6) {
        connectOpts.lookup = (h, _opts, cb) => {
          dns.lookup(h, { family: fam }, cb);
        };
      }
      const socket = tls.connect(connectOpts);
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
        const raw = socket.getPeerCertificate(true) as tls.DetailedPeerCertificate;
        if (!raw || Object.keys(raw).length === 0) {
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
        const cert = pickServiceCertificate(raw, servername);
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

import { parse } from "tldts";

/**
 * RDAP/WHOIS solo responden para el dominio registrable (apex), no para subdominios (p. ej. www).
 * Convierte URL, host con www, etc. al dominio de registro (eTLD+1).
 */
export function registrableDomainForLookup(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;

  let host = raw.toLowerCase();
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      host = raw.replace(/^[a-z]+:\/\//i, "").split("/")[0].toLowerCase();
    }
  }
  host = host.split("/")[0].split(":")[0];

  const p = parse(host);
  const reg = p.domain || p.hostname || host;
  return reg.toLowerCase();
}

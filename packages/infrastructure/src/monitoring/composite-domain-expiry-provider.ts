import type { DomainExpiryProvider, DomainExpiryProbeResult } from "@domain-slayer/application";
import { registrableDomainForLookup } from "./domain-normalize.js";
import { parseRdapDomainJson } from "./rdap-parse.js";
import { parseFlexibleWhois, parseVerisignStyleWhois, queryWhoisRaw } from "./whois-tcp.js";

/** WHOIS puerto 43 cuando RDAP no basta (ccTLD con servidor conocido). */
const WHOIS_FALLBACK_BY_SUFFIX: Record<string, string> = {
  ".cr": "whois.nic.cr",
};

/** Segundo salto WHOIS solo si el texto del registro apunta a otro servidor (p. ej. GoDaddy). */
function parseWhoisReferralHost(text: string): string | null {
  const m = text.match(/Registrar WHOIS Server:\s*(\S+)/i);
  if (!m) return null;
  let h = m[1].trim().toLowerCase();
  h = h.replace(/^https?:\/\//i, "").split("/")[0] ?? h;
  if (!h || h === "whois.verisign-grs.com") return null;
  return h;
}

const FETCH_HEADERS = {
  Accept: "application/rdap+json, application/json;q=0.9",
  "User-Agent": "DomainSlayer/1.0 (+https://github.com) monitoring",
} as const;

async function fetchRdapJson(url: string): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch(url, {
      redirect: "follow",
      headers: FETCH_HEADERS,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function mergeRdap(
  json: unknown,
  expiry: Date | null,
  registrar: string | null
): { expiry: Date | null; registrar: string | null } {
  const p = parseRdapDomainJson(json);
  return {
    expiry: p.expiry && !expiry ? p.expiry : expiry,
    registrar: p.registrar && !registrar ? p.registrar : registrar,
  };
}

/**
 * Fase 1 — solo RDAP: rdap.org y, en .com/.net, RDAP directo Verisign.
 * No WHOIS aquí.
 */
async function probeRdapOnly(d: string): Promise<{ expiry: Date | null; registrar: string | null }> {
  let expiry: Date | null = null;
  let registrar: string | null = null;

  const org = await fetchRdapJson(`https://rdap.org/domain/${encodeURIComponent(d)}`);
  if (org) ({ expiry, registrar } = mergeRdap(org, expiry, registrar));

  if (d.endsWith(".com")) {
    const v = await fetchRdapJson(`https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(d)}`);
    if (v) ({ expiry, registrar } = mergeRdap(v, expiry, registrar));
  } else if (d.endsWith(".net")) {
    const v = await fetchRdapJson(`https://rdap.verisign.com/net/v1/domain/${encodeURIComponent(d)}`);
    if (v) ({ expiry, registrar } = mergeRdap(v, expiry, registrar));
  } else if (d.endsWith(".cr")) {
    const cr = await fetchRdapJson(`https://rdap.nic.cr/domain/${encodeURIComponent(d)}`);
    if (cr) ({ expiry, registrar } = mergeRdap(cr, expiry, registrar));
  }

  return { expiry, registrar };
}

/**
 * Fase 2 — último recurso WHOIS (TCP 43), solo para .com/.net y solo si tras RDAP
 * aún falta fecha de expiración o nombre de registrador.
 * Orden: Verisign → referral al WHOIS del registrador si sigue faltando algo.
 */
async function probeWhoisLastResort(
  d: string,
  expiry: Date | null,
  registrar: string | null
): Promise<{ expiry: Date | null; registrar: string | null; whoisContributed: boolean }> {
  let whoisContributed = false;
  let ex = expiry;
  let reg = registrar;

  const raw = await queryWhoisRaw(d, "whois.verisign-grs.com");
  if (raw) {
    const w = parseVerisignStyleWhois(raw);
    if (w.expiry && !ex) {
      ex = w.expiry;
      whoisContributed = true;
    }
    if (w.registrar && !reg) {
      reg = w.registrar;
      whoisContributed = true;
    }
    const refHost = parseWhoisReferralHost(raw);
    if (refHost && (!ex || !reg)) {
      const raw2 = await queryWhoisRaw(d, refHost);
      if (raw2) {
        const w2 = parseVerisignStyleWhois(raw2);
        if (w2.expiry && !ex) {
          ex = w2.expiry;
          whoisContributed = true;
        }
        if (w2.registrar && !reg) {
          reg = w2.registrar;
          whoisContributed = true;
        }
      }
    }
  }

  return { expiry: ex, registrar: reg, whoisContributed };
}

async function probeCcTldWhois(
  d: string,
  expiry: Date | null,
  registrar: string | null
): Promise<{ expiry: Date | null; registrar: string | null; whoisContributed: boolean }> {
  const suffix = Object.keys(WHOIS_FALLBACK_BY_SUFFIX).find((s) => d.endsWith(s));
  if (!suffix) {
    return { expiry, registrar, whoisContributed: false };
  }
  if (expiry && registrar) {
    return { expiry, registrar, whoisContributed: false };
  }

  const host = WHOIS_FALLBACK_BY_SUFFIX[suffix];
  const raw = await queryWhoisRaw(d, host);
  if (!raw) {
    return { expiry, registrar, whoisContributed: false };
  }

  const w = parseFlexibleWhois(raw);
  let ex = expiry;
  let reg = registrar;
  let contributed = false;
  if (w.expiry && !ex) {
    ex = w.expiry;
    contributed = true;
  }
  if (w.registrar && !reg) {
    reg = w.registrar;
    contributed = true;
  }
  return { expiry: ex, registrar: reg, whoisContributed: contributed };
}

/**
 * Orden: 1) RDAP (rdap.org + TLDs conocidos) 2) WHOIS Verisign si .com/.net y falta dato
 * 3) WHOIS ccTLD conocido (p. ej. .cr → whois.nic.cr) si aún falta expiración o registrador.
 */
export class CompositeDomainExpiryProvider implements DomainExpiryProvider {
  async probe(domain: string): Promise<DomainExpiryProbeResult> {
    const d = registrableDomainForLookup(domain);
    if (!d) {
      return { expiry: null, registrar: null, source: "unavailable" };
    }

    let { expiry, registrar } = await probeRdapOnly(d);
    let whoisContributed = false;

    const isVerisignTld = d.endsWith(".com") || d.endsWith(".net");
    let needsMore = !expiry || !registrar;

    if (needsMore && isVerisignTld) {
      const w = await probeWhoisLastResort(d, expiry, registrar);
      expiry = w.expiry;
      registrar = w.registrar;
      whoisContributed = w.whoisContributed || whoisContributed;
      needsMore = !expiry || !registrar;
    }

    if (needsMore) {
      const c = await probeCcTldWhois(d, expiry, registrar);
      expiry = c.expiry;
      registrar = c.registrar;
      whoisContributed = c.whoisContributed || whoisContributed;
    }

    if (!expiry && !registrar) {
      return { expiry: null, registrar: null, source: "unavailable" };
    }

    const source: DomainExpiryProbeResult["source"] = whoisContributed ? "whois" : "rdap";
    return { expiry, registrar, source };
  }
}

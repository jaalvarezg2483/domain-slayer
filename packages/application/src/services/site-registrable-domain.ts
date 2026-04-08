/** Dominio «raíz» del inventario: quita `www.` inicial y punto final. */
export function registrableSiteDomain(siteDomain: string): string {
  let d = siteDomain.trim().toLowerCase().replace(/\.$/, "");
  if (d.startsWith("www.")) d = d.slice(4);
  return d;
}

export function httpsHostUnderInventoryDomain(hostname: string, siteDomain: string): boolean {
  const dom = registrableSiteDomain(siteDomain);
  const h = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!dom) return false;
  return h === dom || h.endsWith(`.${dom}`);
}

/** Hostname para TLS alineado con la URL HTTPS final del probe (mismo dominio registrable). */
export function tlsHostnameAfterRedirect(
  siteDomain: string,
  urlHostname: string,
  httpsEffectiveUrl: string
): string {
  const dom = registrableSiteDomain(siteDomain);
  try {
    const eff = new URL(httpsEffectiveUrl).hostname.toLowerCase().replace(/\.$/, "");
    if (!dom) return urlHostname.trim().toLowerCase().replace(/\.$/, "");
    if (eff === dom || eff.endsWith(`.${dom}`)) return eff;
  } catch {
    /* ignore */
  }
  return urlHostname.trim().toLowerCase().replace(/\.$/, "");
}

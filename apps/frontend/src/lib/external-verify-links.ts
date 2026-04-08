/** Dominio registrable sin `www.` (enlaces externos, WHOIS, botón www en formulario). */
export function registrableDomainForLookup(domain: string): string {
  let d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (d.startsWith("www.")) d = d.slice(4);
  return d;
}

/** URL principal del sitio: la guardada o, si no es válida, https://{dominio}/ */
export function primarySiteUrl(siteUrl: string, domain: string): string {
  const u = siteUrl?.trim();
  if (u) {
    try {
      void new URL(u);
      return u;
    } catch {
      /* continuar */
    }
  }
  const d = registrableDomainForLookup(domain);
  return d ? `https://${d}/` : "";
}

/**
 * Misma URL con un parámetro de consulta único para forzar petición nueva en muchos CDN/navegadores.
 * No sustituye ventana privada: las cookies de sesión del perfil normal siguen aplicando.
 */
export function siteUrlWithHttpCacheBuster(siteUrl: string, domain: string): string {
  const base = primarySiteUrl(siteUrl, domain);
  if (!base) return "";
  try {
    const u = new URL(base);
    u.searchParams.set("ds_nocache", String(Date.now()));
    return u.href;
  } catch {
    return base;
  }
}

/** Buscador RDAP oficial (ICANN). */
export function icannLookupUrl(domain: string): string {
  const d = registrableDomainForLookup(domain);
  return d ? `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(d)}` : "";
}

/** WHOIS web público (tercero). */
export function whoisComLookupUrl(domain: string): string {
  const d = registrableDomainForLookup(domain);
  return d ? `https://www.whois.com/whois/${encodeURIComponent(d)}` : "";
}

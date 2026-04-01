import type { SiteRow } from "../types";

function isGodaddyRegistrar(text: string | null | undefined): boolean {
  return !!text?.trim() && /godaddy|go\s*daddy/i.test(text);
}

export function ExpiryContextBlock({ site }: { site: SiteRow }) {
  const reg = site.registrarProvider?.trim() || null;
  const sslIss = site.sslIssuer?.trim() || null;
  const sslProv = site.sslProvider?.trim() || null;
  const dns = site.dnsProvider?.trim() || null;
  const host = site.hostingProvider?.trim() || null;
  const email = site.contactEmail?.trim() || null;
  const tech = site.technicalOwner?.trim() || null;

  return (
    <div className="expiry-context-block">
      <div className="muted small expiry-context-line">
        <strong>Dominio (registro):</strong>{" "}
        {reg ? (
          <>
            {isGodaddyRegistrar(reg) && <span className="expiry-registrar-pill">GoDaddy / similar</span>}{" "}
            <span>{reg}</span>
          </>
        ) : (
          "— (sin dato; suele rellenarse tras el chequeo de dominio)"
        )}
      </div>
      <div className="muted small expiry-context-line">
        <strong>SSL (certificado):</strong> {sslIss || sslProv || "—"}
        {sslIss && sslProv && sslIss !== sslProv ? ` · Proveedor indicado: ${sslProv}` : null}
      </div>
      {(dns || host) && (
        <div className="muted small expiry-context-line">
          {dns && (
            <span>
              <strong>DNS:</strong> {dns}{" "}
            </span>
          )}
          {host && (
            <span>
              <strong>Hosting:</strong> {host}
            </span>
          )}
        </div>
      )}
      {(tech || email) && (
        <div className="muted small expiry-context-line">
          {tech && (
            <span>
              <strong>Contacto técnico:</strong> {tech}{" "}
            </span>
          )}
          {email && (
            <span>
              <strong>Email:</strong> {email}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

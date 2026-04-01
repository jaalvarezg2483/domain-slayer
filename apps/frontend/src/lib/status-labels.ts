/** Etiquetas en español para estados técnicos (API en inglés). */

import { EXPIRY_CRITICAL_DAYS } from "./expiry-proximity";

const health: Record<string, string> = {
  healthy: "Correcto",
  warning: "Atención",
  critical: "Crítico",
  unknown: "Desconocido",
};

const ssl: Record<string, string> = {
  valid: "Válido",
  expiring_soon: "Por vencer",
  expired: "Vencido",
  tls_error: "Error TLS",
  hostname_mismatch: "Nombre no coincide",
  unknown: "Desconocido",
};

const dns: Record<string, string> = {
  ok: "Correcto",
  warning: "Atención",
  error: "Error",
  unknown: "Desconocido",
};

const domain: Record<string, string> = {
  ok: "Correcto",
  warning: "Atención",
  error: "Error",
  unknown: "Desconocido",
};

const severity: Record<string, string> = {
  info: "Info",
  warning: "Advertencia",
  critical: "Crítica",
};

const check: Record<string, string> = {
  success: "Correcto",
  partial: "Parcial",
  failed: "Fallido",
  unknown: "Desconocido",
};

const domainExpiry: Record<string, string> = {
  ok: "Vigente",
  expiring_soon: "Por vencer",
  expired: "Vencido",
  unknown: "Desconocido",
};

const http: Record<string, string> = {
  ok: "Correcto",
  error: "Error",
  unknown: "Desconocido",
};

export function labelHealthStatus(kind: string): string {
  return health[kind] ?? kind;
}

export function labelSslStatus(kind: string): string {
  return ssl[kind] ?? kind;
}

export function labelDnsStatus(kind: string): string {
  return dns[kind] ?? kind;
}

export function labelDomainStatus(kind: string): string {
  return domain[kind] ?? kind;
}

export function labelSeverity(kind: string): string {
  return severity[kind] ?? kind;
}

export function labelCheckStatus(kind: string): string {
  return check[kind] ?? kind;
}

export function labelDomainExpiryStatus(kind: string): string {
  return domainExpiry[kind] ?? kind;
}

export function labelHttpStatus(kind: string): string {
  return http[kind] ?? kind;
}

export function labelEnvironment(env: string): string {
  const m: Record<string, string> = {
    production: "Producción",
    staging: "Staging",
    development: "Desarrollo",
  };
  return m[env] ?? env;
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (86_400_000));
}

/** Compara host del sitio vs CN del certificado (sin www) para detectar errores de tipeo en el dominio. */
function hostForMismatchCheck(host: string): string {
  const h = host.trim().toLowerCase();
  if (!h || h.includes("{")) return "";
  return h.startsWith("www.") ? h.slice(4) : h;
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface SiteDetailFields {
  /** Dominio registrado en el inventario (RDAP/WHOIS consultan exactamente este nombre). */
  domain?: string;
  healthStatus?: string;
  sslStatus?: string;
  dnsStatus?: string;
  domainStatus?: string;
  domainExpiryStatus?: string;
  checkStatus?: string;
  httpStatus?: string;
  httpsStatus?: string;
  sslSubject?: string | null;
  sslValidTo?: string | null;
  domainExpiryFinal?: string | null;
  sslHostnameMatch?: boolean | null;
  lastCheckedAt?: string | null;
  registrarProvider?: string | null;
}

/** Motivos legibles para el detalle del sitio (reporte operativo). */
export function buildOperationalReport(site: SiteDetailFields): { level: "ok" | "warn" | "bad"; text: string }[] {
  const now = new Date();
  const out: { level: "ok" | "warn" | "bad"; text: string }[] = [];

  const reg = site.registrarProvider?.trim();
  if (reg) {
    out.push({
      level: "ok",
      text: `Registrador del dominio (RDAP/WHOIS): ${reg}.`,
    });
  }

  const sslTo = parseDate(site.sslValidTo);
  const ssl = site.sslStatus ?? "";
  if (ssl === "expired" || ssl === "tls_error" || ssl === "hostname_mismatch") {
    const detail =
      ssl === "expired"
        ? "El certificado SSL ya no está vigente."
        : ssl === "tls_error"
          ? "No se pudo establecer una conexión TLS válida con el servidor."
          : "El certificado no coincide con el nombre del sitio (hostname).";
    out.push({ level: "bad", text: `SSL: ${detail}` });
  } else if (sslTo && ssl === "expiring_soon") {
    const d = daysBetween(now, sslTo);
    if (d < 0) {
      out.push({ level: "bad", text: "SSL: el certificado figura con fecha de fin ya pasada." });
    } else {
      const level = d < EXPIRY_CRITICAL_DAYS ? "bad" : "warn";
      out.push({
        level,
        text: `SSL: el certificado caduca en ${d} día(s), el ${sslTo.toLocaleDateString("es-ES", { dateStyle: "long" })}.`,
      });
    }
  }

  const domExp = parseDate(site.domainExpiryFinal);
  const domSt = site.domainExpiryStatus ?? "";
  if (domExp) {
    const dd = daysBetween(now, domExp);
    if (dd < 0) {
      out.push({ level: "bad", text: "Dominio: la fecha de expiración indicada ya pasó; verificar renovación." });
    } else if (domSt === "expiring_soon" || (dd <= 60 && dd >= 0)) {
      out.push({
        level: dd < EXPIRY_CRITICAL_DAYS ? "bad" : "warn",
        text: `Dominio: vence en ${dd} día(s), el ${domExp.toLocaleDateString("es-ES", { dateStyle: "long" })}.`,
      });
    }
  } else if (domSt === "unknown") {
    out.push({
      level: "warn",
      text:
        "Dominio: no se obtuvo fecha automática (RDAP; WHOIS TCP en .com/.net y en algunos ccTLD como .cr). No implica que el registro no exista: dominio mal escrito, firewall al puerto 43 o TLD aún sin integración. Indique la fecha en «Editar sitio» → sección «Expiración del dominio».",
    });
    const d = site.domain?.trim();
    const cn = site.sslSubject?.trim();
    const hd = d ? hostForMismatchCheck(d) : "";
    const hs = cn ? hostForMismatchCheck(cn) : "";
    if (hd && hs && hd !== hs) {
      out.push({
        level: "warn",
        text: `El dominio del sitio (${d}) no coincide con el nombre del certificado SSL (${cn}); si el certificado es el correcto, corrija el dominio en «Editar» para que RDAP/WHOIS consulten el nombre registrado.`,
      });
    }
  }

  const dns = site.dnsStatus ?? "";
  if (dns === "error") {
    out.push({ level: "warn", text: "DNS: la consulta de registros devolvió error o no respondió como se esperaba." });
  } else if (dns === "unknown") {
    out.push({ level: "warn", text: "DNS: estado no verificado o indeterminado." });
  }

  const http = site.httpStatus ?? "";
  const https = site.httpsStatus ?? "";
  if (http === "error") {
    out.push({ level: "warn", text: "HTTP: el sitio no respondió correctamente por HTTP." });
  }
  if (https === "error") {
    out.push({ level: "warn", text: "HTTPS: el sitio no respondió correctamente por HTTPS." });
  }

  if (site.sslHostnameMatch === false) {
    out.push({ level: "bad", text: "El certificado no coincide con el nombre de host accedido." });
  }

  const domStat = site.domainStatus ?? "";
  if (domStat === "error") {
    out.push({ level: "bad", text: "Dominio: hay incidencias detectadas (expiración o DNS)." });
  } else if (domStat === "warning") {
    out.push({ level: "warn", text: "Dominio: revisar caducidad o DNS (estado de advertencia)." });
  }

  const hs = site.healthStatus ?? "";
  if (out.length === 0 && hs === "healthy") {
    out.push({
      level: "ok",
      text: "No se detectan incidencias prioritarias en SSL, dominio ni conectividad según el último chequeo.",
    });
  } else if (out.length === 0 && hs === "warning") {
    out.push({
      level: "warn",
      text: "Estado general en advertencia: revise SSL, dominio y conectividad; puede haber umbrales próximos no listados arriba.",
    });
  } else if (out.length === 0 && hs === "critical") {
    out.push({
      level: "bad",
      text: "Estado crítico: revise certificado, DNS y respuesta HTTP/HTTPS.",
    });
  }

  return out;
}

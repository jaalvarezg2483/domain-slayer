import net from "node:net";

/** Consulta WHOIS en puerto 43 (texto plano). Cierra al timeout aunque el servidor no cierre el socket. */
export async function queryWhoisRaw(domain: string, host: string, timeoutMs = 15000): Promise<string | null> {
  const d = domain.trim().toLowerCase();
  return new Promise((resolve) => {
    const socket = net.createConnection({ port: 43, host });
    let buf = "";
    let settled = false;

    const done = (val: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(val);
    };

    const timer = setTimeout(() => done(buf.length ? buf : null), timeoutMs);

    socket.setEncoding("utf8");
    socket.on("connect", () => socket.write(`${d}\r\n`));
    socket.on("data", (chunk: string) => {
      buf += chunk;
    });
    socket.on("end", () => done(buf || null));
    socket.on("error", () => done(buf.length ? buf : null));
  });
}

/** Parseo típico de respuesta Verisign / registradores en .com / .net */
export function parseVerisignStyleWhois(text: string): { expiry: Date | null; registrar: string | null } {
  let registrar: string | null = null;
  const regM = text.match(/^\s*Registrar:\s*(.+)$/im) ?? text.match(/Registrar Name:\s*(.+)$/im);
  if (regM) registrar = regM[1].trim();

  const expPatterns = [
    /Registry Expiry Date:\s*(.+)/i,
    /Registrar Registration Expiration Date:\s*(.+)/i,
    /Expiration Date:\s*(.+)/i,
    /Expires On:\s*(.+)/i,
    /paid-till:\s*(.+)/i,
  ];

  let expiry: Date | null = null;
  for (const p of expPatterns) {
    const m = text.match(p);
    if (!m?.[1]) continue;
    const raw = m[1].trim();
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) {
      expiry = dt;
      break;
    }
  }

  return { expiry, registrar };
}

/** Fecha tipo 31.07.2026 o 31.07.2026 19:00:35 (whoisd / NIC.cr y similares). */
export function parseEuropeanDotDate(raw: string): Date | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Combina patrones Verisign con respuestas whoisd (p. ej. NIC.cr: `registrar:`, `expire:`).
 */
export function parseFlexibleWhois(text: string): { expiry: Date | null; registrar: string | null } {
  const v = parseVerisignStyleWhois(text);
  let registrar = v.registrar;
  let expiry = v.expiry;

  const regCr = text.match(/^\s*registrar:\s*(.+)$/im);
  if (regCr?.[1]) registrar = regCr[1].trim();

  if (!expiry) {
    const expCr = text.match(/^\s*expire:\s*(.+)$/im);
    if (expCr?.[1]) {
      const eu = parseEuropeanDotDate(expCr[1]);
      if (eu) expiry = eu;
      else {
        const dt = new Date(expCr[1].trim());
        if (!Number.isNaN(dt.getTime())) expiry = dt;
      }
    }
  }

  return { expiry, registrar };
}

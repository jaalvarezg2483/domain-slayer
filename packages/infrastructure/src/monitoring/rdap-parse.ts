/** Extrae expiración y registrador de un documento RDAP JSON (RFC 9083). */

function extractFnFromVcard(vcard: unknown): string | null {
  if (!Array.isArray(vcard) || vcard[0] !== "vcard") return null;
  const rows = vcard[1] as unknown[];
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const name = String(row[0] ?? "").toLowerCase();
    if (name === "fn" || name === "org") {
      const val = row[3];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  }
  return null;
}

function eventIsExpiry(action: string): boolean {
  const a = action.toLowerCase();
  if (a.includes("delet") || a.includes("transfer")) return false;
  if (a.includes("expir")) return true;
  return a === "registration expiration";
}

export function parseRdapDomainJson(json: unknown): { expiry: Date | null; registrar: string | null } {
  const o = json as Record<string, unknown>;
  const events = (o.events as Array<{ eventAction?: string; eventDate?: string }>) ?? [];
  let expiry: Date | null = null;
  for (const e of events) {
    if (!e?.eventDate || !e.eventAction) continue;
    if (!eventIsExpiry(e.eventAction)) continue;
    const d = new Date(e.eventDate);
    if (Number.isNaN(d.getTime())) continue;
    const a = e.eventAction.toLowerCase();
    if (a.includes("expir") || a === "registration expiration") {
      expiry = d;
      break;
    }
    if (!expiry) expiry = d;
  }

  let registrar: string | null = null;
  const entities = (o.entities as unknown[]) ?? [];
  for (const ent of entities) {
    if (!ent || typeof ent !== "object") continue;
    const e = ent as Record<string, unknown>;
    const roles = (e.roles as string[]) ?? [];
    if (!roles.some((r) => String(r).toLowerCase() === "registrar")) continue;
    const vcard = e.vcardArray;
    const name = extractFnFromVcard(vcard);
    if (name) {
      registrar = name;
      break;
    }
  }

  return { expiry, registrar };
}

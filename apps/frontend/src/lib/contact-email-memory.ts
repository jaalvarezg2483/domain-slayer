const STORAGE_KEY = "domain-slayer-contact-emails";
const MAX_ITEMS = 40;

function isLikelyEmail(s: string): boolean {
  const t = s.trim();
  return t.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export function getStoredContactEmails(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const x of arr) {
      if (typeof x !== "string") continue;
      const e = x.trim();
      if (!isLikelyEmail(e)) continue;
      const k = e.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out;
  } catch {
    return [];
  }
}

/** Guarda el correo al dar Guardar en un sitio (para sugerencias después). */
export function rememberContactEmail(email: string): void {
  if (!isLikelyEmail(email)) return;
  const normalized = email.trim();
  const lower = normalized.toLowerCase();
  const rest = getStoredContactEmails().filter((e) => e.toLowerCase() !== lower);
  const next = [normalized, ...rest].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / privado */
  }
}

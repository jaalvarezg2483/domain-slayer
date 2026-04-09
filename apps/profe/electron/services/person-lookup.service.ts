/**
 * Consulta opcional de datos por cédula vía URL configurable (proxy propio).
 *
 * No existe API pública oficial del Registro Civil de Costa Rica para integrar en apps.
 * El TSE ofrece consulta web manual; terceros (Apify, etc.) requieren contrato y API key.
 * Esta capa solo llama a la URL que configures (tú expones el formato que necesites).
 *
 * Contrato sugerido del proxy:
 *   GET {urlBase}/{cedulaSinGuiones}
 *   Cabecera opcional: Authorization: Bearer {secret}
 *   Respuesta JSON con al menos uno de: fullName | nombreCompleto | name | nombre + apellido1
 */
import { getPersonLookupConfig } from '../auth-store.js';

export type PersonLookupResult = {
  ok: true;
  fullName?: string;
  raw?: unknown;
};

export type PersonLookupError = {
  ok: false;
  message: string;
};

function normalizeCedula(c: string): string {
  return c.replace(/[\s-]/g, '').trim();
}

export async function queryPersonByCedula(cedula: string): Promise<PersonLookupResult | PersonLookupError> {
  const { url, secret } = getPersonLookupConfig();
  const key = normalizeCedula(cedula);
  if (!key) {
    return { ok: false, message: 'Indica un número de cédula.' };
  }
  if (!url) {
    return {
      ok: false,
      message:
        'No hay URL de consulta configurada. En Usuarios (admin) puedes guardar la URL de un servicio ' +
        'autorizado o un proxy tuyo que devuelva JSON con el nombre. El Registro Civil no ofrece API pública oficial.',
    };
  }

  const endpoint = `${url}/${encodeURIComponent(key)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  try {
    const res = await fetch(endpoint, { method: 'GET', headers });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return { ok: false, message: 'La respuesta no es JSON válido.' };
    }
    if (!res.ok) {
      const msg = typeof data.message === 'string' ? data.message : `Error HTTP ${res.status}`;
      return { ok: false, message: msg };
    }
    const fullName =
      (typeof data.fullName === 'string' && data.fullName) ||
      (typeof data.nombreCompleto === 'string' && data.nombreCompleto) ||
      (typeof data.name === 'string' && data.name) ||
      [data.nombre, data.apellido1, data.apellido2]
        .filter((x) => typeof x === 'string' && (x as string).trim())
        .map((x) => (x as string).trim())
        .join(' ')
        .trim() ||
      undefined;
    return { ok: true, fullName: fullName || undefined, raw: data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error de red';
    return { ok: false, message: msg };
  }
}

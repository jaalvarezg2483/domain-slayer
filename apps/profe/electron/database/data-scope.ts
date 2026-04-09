import { getSession } from '../auth-store.js';

/**
 * Alcance de datos académicos: siempre el usuario de la sesión (admin o profesor).
 * El rol administrador solo añade permisos en IPC (usuarios, correo, borrar ficha global de alumno, etc.);
 * no ve colegios/cursos de otros.
 */
export type DataScope = { userId: number };

export function getDataScope(): DataScope {
  const s = getSession();
  if (!s) throw new Error('Debes iniciar sesión para continuar.');
  const userId = Number(s.userId);
  if (!Number.isFinite(userId)) {
    throw new Error('Sesión inválida. Cierra sesión y vuelve a entrar.');
  }
  return { userId };
}

/**
 * API de autenticación expuesta por el preload de Electron.
 * No existe si abres solo Vite en el navegador (localhost:5173).
 */
export function getElectronAuth() {
  if (typeof window === 'undefined') {
    throw new Error('Entorno no soportado');
  }
  const auth = window.electronAPI?.auth;
  if (!auth) {
    throw new Error(
      'Esta pantalla solo funciona dentro de la app de escritorio. No uses el navegador con localhost:5173. En una terminal del proyecto ejecuta: npm run electron:dev',
    );
  }
  return auth;
}

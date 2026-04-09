/** App de escritorio con SQLite real (no mock del navegador). */
export function isRealElectron(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.electronAPI && !window.__GESTOR_BROWSER_PREVIEW__);
}

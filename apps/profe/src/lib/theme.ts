const STORAGE_KEY = 'gestor-academico-theme';

export type ThemeMode = 'light' | 'dark';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'dark' || v === 'light') return v;
  return 'light';
}

export function setStoredTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

/** Aplica clase `dark` en <html> según el modo. */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

export function initTheme(): ThemeMode {
  const mode = getStoredTheme();
  applyTheme(mode);
  return mode;
}

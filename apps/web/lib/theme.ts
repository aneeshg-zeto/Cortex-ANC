export const THEME_STORAGE_KEY = 'cortex-theme';

export type ThemeMode = 'light' | 'dark';

export const THEME_CHANGE_EVENT = 'cortex-theme-change';

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

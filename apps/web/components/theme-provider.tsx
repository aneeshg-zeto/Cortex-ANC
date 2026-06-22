'use client';

import {
  applyTheme,
  readStoredTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '@/lib/theme';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyTheme(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: mode }));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: next }));
      return next;
    });
  }, []);

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);

    function onStorage(e: StorageEvent) {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const mode: ThemeMode = e.newValue === 'light' ? 'light' : 'dark';
        setThemeState(mode);
        applyTheme(mode);
      }
    }

    function onCustom(e: Event) {
      const mode = (e as CustomEvent<ThemeMode>).detail;
      if (mode === 'light' || mode === 'dark') setThemeState(mode);
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener(THEME_CHANGE_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, onCustom);
    };
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useThemeOptional() {
  return useContext(ThemeContext);
}

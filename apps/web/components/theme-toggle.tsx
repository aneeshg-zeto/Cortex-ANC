'use client';

import { Moon, Sun } from 'lucide-react';

import { useThemeOptional } from '@/components/theme-provider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const themeCtx = useThemeOptional();
  if (!themeCtx) return null;

  const { theme: mode, toggleTheme } = themeCtx;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground ${className}`}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {mode === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

// Re-export for scripts / layout
export { applyTheme, readStoredTheme, THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme';

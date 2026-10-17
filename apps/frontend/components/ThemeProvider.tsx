'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  getSystemTheme,
  isTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  type ResolvedTheme,
  type Theme,
} from '@/lib/theme';

export type { Theme, ResolvedTheme } from '@/lib/theme';

interface ThemeContextType {
  /** The user's preference: light, dark or follow the OS. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** The theme actually applied to the document. */
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from the same values the server renders with to avoid hydration
  // mismatches. The real document theme is already applied by the inline
  // script in the root layout, so there is no flash while this syncs.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');
  // Until the stored preference is read, the defaults above are placeholders
  // and must not be written to the DOM (that would undo the inline script).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setThemeState(readStoredTheme());
    setSystemTheme(getSystemTheme());
    setHydrated(true);

    const mediaQuery = window.matchMedia?.(DARK_MEDIA_QUERY);
    const handleSystemChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    mediaQuery?.addEventListener('change', handleSystemChange);

    // Keep tabs in sync when the preference changes elsewhere.
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(isTheme(event.newValue) ? event.newValue : DEFAULT_THEME);
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      mediaQuery?.removeEventListener('change', handleSystemChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const resolvedTheme = resolveTheme(theme, systemTheme);

  useEffect(() => {
    if (hydrated) applyTheme(resolvedTheme);
  }, [hydrated, resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeStoredTheme(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, setTheme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

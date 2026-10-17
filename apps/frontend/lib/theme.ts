/**
 * Theme primitives shared by the React ThemeProvider and the inline
 * pre-hydration script in the root layout. Keeping both in one module
 * guarantees the server-injected script and the client agree on the
 * storage key, valid values and the DOM contract.
 */

export const THEMES = ['light', 'dark', 'system'] as const;

export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, 'system'>;

export const THEME_STORAGE_KEY = 'vaultix-theme';
export const DEFAULT_THEME: Theme = 'system';
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(theme: Theme, systemTheme: ResolvedTheme = getSystemTheme()): ResolvedTheme {
  return theme === 'system' ? systemTheme : theme;
}

/** Reads the persisted preference, falling back to the default for missing or tampered values. */
export function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    // Storage can throw in private mode or when blocked by the browser.
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session.
  }
}

/**
 * Applies the resolved theme to the document root. `color-scheme` is
 * handled in globals.css via the `.dark` class so native controls and
 * scrollbars follow the theme too.
 */
export function applyTheme(resolved: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.classList.toggle('dark', resolved === 'dark');
  root.dataset.theme = resolved;
}

/**
 * Inline script rendered in <head> before any content paints. It must be
 * self-contained (no imports at runtime), so the constants are serialised in.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var v=${JSON.stringify(THEMES)};var t=null;try{t=localStorage.getItem(k)}catch(e){}if(v.indexOf(t)<0){t=${JSON.stringify(
  DEFAULT_THEME,
)}}var d=t==='dark'||(t==='system'&&!!window.matchMedia&&window.matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches===true);var r=document.documentElement;r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light'}catch(e){}})();`;

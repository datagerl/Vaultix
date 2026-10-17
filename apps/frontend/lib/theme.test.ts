import {
  THEME_STORAGE_KEY,
  applyTheme,
  isTheme,
  readStoredTheme,
  resolveTheme,
  themeInitScript,
  writeStoredTheme,
} from './theme';

function mockSystemDark(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: dark,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

function runInitScript() {
  // Executes the exact string injected into <head> by the root layout.
  new Function(themeInitScript)();
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  delete document.documentElement.dataset.theme;
  mockSystemDark(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('isTheme', () => {
  it('accepts only known themes', () => {
    expect(isTheme('light')).toBe(true);
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('system')).toBe(true);
    expect(isTheme('blue')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('returns explicit choices unchanged', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('follows the system for "system"', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
  });
});

describe('storage helpers', () => {
  it('round-trips a stored theme', () => {
    writeStoredTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('falls back to system for missing or invalid values', () => {
    expect(readStoredTheme()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readStoredTheme()).toBe('system');
  });

  it('does not throw when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredTheme()).toBe('system');
    expect(() => writeStoredTheme('dark')).not.toThrow();
  });
});

describe('applyTheme', () => {
  it('toggles the dark class and data-theme attribute', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('themeInitScript (pre-paint, prevents flash)', () => {
  it.each([
    ['dark', false, true],
    ['dark', true, true],
    ['light', true, false],
    ['light', false, false],
    ['system', true, true],
    ['system', false, false],
    [null, true, true],
    ['garbage', true, true],
  ])('stored=%s, systemDark=%s -> dark=%s', (stored, systemDark, expectDark) => {
    if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored as string);
    mockSystemDark(systemDark as boolean);

    runInitScript();

    expect(document.documentElement.classList.contains('dark')).toBe(expectDark);
    expect(document.documentElement.dataset.theme).toBe(expectDark ? 'dark' : 'light');
  });

  it('removes a stale dark class when the stored theme is light', () => {
    document.documentElement.classList.add('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    runInitScript();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('never throws, even if storage and matchMedia are unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
    expect(runInitScript).not.toThrow();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

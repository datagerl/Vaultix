import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { THEME_STORAGE_KEY } from '@/lib/theme';

type ChangeListener = (event: { matches: boolean }) => void;

let systemDark = false;
let listeners: ChangeListener[] = [];

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      get matches() {
        return systemDark;
      },
      media: query,
      addEventListener: (_: string, cb: ChangeListener) => listeners.push(cb),
      removeEventListener: (_: string, cb: ChangeListener) => {
        listeners = listeners.filter((l) => l !== cb);
      },
    })),
  });
}

function setSystemDark(dark: boolean) {
  systemDark = dark;
  act(() => listeners.forEach((l) => l({ matches: dark })));
}

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
      <button onClick={() => setTheme('system')}>system</button>
    </div>
  );
}

const html = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html.className = '';
  delete html.dataset.theme;
  systemDark = false;
  listeners = [];
  installMatchMedia();
});

describe('ThemeProvider', () => {
  it('defaults to system and follows the OS preference', () => {
    systemDark = true;
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(html).toHaveClass('dark');
  });

  it('restores a persisted theme across sessions', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    systemDark = true;
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(html).not.toHaveClass('dark');
  });

  it('persists and applies a newly selected theme', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByText('dark').click());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(html).toHaveClass('dark');
    expect(html.dataset.theme).toBe('dark');

    act(() => screen.getByText('light').click());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(html).not.toHaveClass('dark');
  });

  it('reacts to OS changes only while set to system', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    setSystemDark(true);
    expect(html).toHaveClass('dark');

    act(() => screen.getByText('light').click());
    setSystemDark(true);
    expect(html).not.toHaveClass('dark');
  });

  it('syncs when another tab changes the preference', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'dark' }));
    });
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(html).toHaveClass('dark');
  });

  it('does not strip the pre-paint dark class while mounting (no flash)', () => {
    // Simulate the inline script having already applied dark.
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    html.classList.add('dark');

    const classChanges: (string | null)[] = [];
    const observer = new MutationObserver((records) =>
      records.forEach((r) => classChanges.push((r.target as HTMLElement).className)),
    );
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    observer.takeRecords().forEach((r) => classChanges.push((r.target as HTMLElement).className));
    observer.disconnect();

    expect(classChanges).toEqual([]);
    expect(html).toHaveClass('dark');
  });

  it('throws a helpful error outside the provider', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useTheme must be used within a ThemeProvider');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { paintTheme } from '../paint-theme';
import { APP_THEMES, THEME_COLOR, THEME_STORAGE_KEY } from '../themes';

function osPrefersDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: dark }))
  );
}

function themeColorMeta() {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#fcfcfc';
  document.head.append(meta);
  return meta;
}

/** The inline script the browser runs before first paint, run the same way. */
function runSerialised() {
  new Function(
    `(${paintTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)},${JSON.stringify(THEME_COLOR)})`
  )();
}

const html = document.documentElement;

describe('paintTheme', () => {
  afterEach(() => {
    localStorage.clear();
    html.className = '';
    html.style.colorScheme = '';
    document.head.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it.each([
    ['dark', 'dark', '#0f0f0e'],
    ['aurora', 'aurora', '#131114'],
    ['light', '', '#fcfcfc'],
  ])('paints a stored %s choice', (choice, className, color) => {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
    osPrefersDark(true);
    const meta = themeColorMeta();

    paintTheme(THEME_STORAGE_KEY, THEME_COLOR);

    expect(html.className).toBe(className);
    expect(html.style.colorScheme).toBe(choice === 'light' ? 'light' : 'dark');
    expect(meta.content).toBe(color);
  });

  it.each([
    [null, true, 'dark'],
    ['system', false, ''],
    ['sepia', true, 'dark'],
  ])('treats %s as System (OS dark: %s)', (stored, dark, className) => {
    if (stored) localStorage.setItem(THEME_STORAGE_KEY, stored);
    osPrefersDark(dark);

    paintTheme(THEME_STORAGE_KEY, THEME_COLOR);

    expect(html.className).toBe(className);
  });

  it('switches one dark theme for the other and keeps unrelated classes', () => {
    html.className = 'dark keep-me';
    localStorage.setItem(THEME_STORAGE_KEY, 'aurora');

    paintTheme(THEME_STORAGE_KEY, THEME_COLOR);

    expect(html.classList.contains('dark')).toBe(false);
    expect(html.classList.contains('aurora')).toBe(true);
    expect(html.classList.contains('keep-me')).toBe(true);
  });

  it('paints a forced theme whatever is stored', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'aurora');

    paintTheme(THEME_STORAGE_KEY, THEME_COLOR, 'light');

    expect(html.className).toBe('');
  });

  // The inline script is this function's source: it must not lean on
  // anything outside itself, or the script would throw before first paint.
  it('works serialised, as the before-paint script', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'aurora');
    const meta = themeColorMeta();

    runSerialised();

    expect(html.className).toBe('aurora');
    expect(meta.content).toBe('#131114');
  });

  it('knows every theme the app has', () => {
    for (const theme of APP_THEMES) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      paintTheme(THEME_STORAGE_KEY, THEME_COLOR);
      expect(html.className).toBe(theme === 'light' ? '' : theme);
    }
  });
});

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeColorScript } from '../theme-color-script';

/** Runs the inline script the way the browser does on first parse. */
function runScript() {
  const { container } = render(<ThemeColorScript />);
  const source = container.querySelector('script')?.innerHTML ?? '';
  new Function(source)();
}

function themeColorMeta() {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#fcfcfc';
  document.head.append(meta);
  return meta;
}

function osPrefersDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: dark }))
  );
}

describe('ThemeColorScript', () => {
  afterEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it.each([
    ['dark', '#0f0f0e'],
    ['aurora', '#131114'],
    ['light', '#fcfcfc'],
  ])('paints the bar for a stored %s choice', (choice, color) => {
    localStorage.setItem('kallo-theme', choice);
    osPrefersDark(true);
    const meta = themeColorMeta();

    runScript();

    expect(meta.content).toBe(color);
  });

  it('follows the OS when nothing is stored (System)', () => {
    osPrefersDark(true);
    const meta = themeColorMeta();

    runScript();

    expect(meta.content).toBe('#0f0f0e');
  });

  it('leaves the bar alone for a value it does not know', () => {
    localStorage.setItem('kallo-theme', 'sepia');
    osPrefersDark(false);
    const meta = themeColorMeta();

    runScript();

    expect(meta.content).toBe('#fcfcfc');
  });
});

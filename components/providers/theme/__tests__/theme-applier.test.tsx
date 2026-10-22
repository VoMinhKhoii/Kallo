import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeThemeChoice } from '@/lib/core/theme/theme-store';
import { THEME_STORAGE_KEY } from '@/lib/core/theme/themes';
import { ThemeApplier } from '../theme-applier';

const html = document.documentElement;

describe('ThemeApplier', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    localStorage.clear();
    html.className = '';
    vi.unstubAllGlobals();
  });

  it('paints a choice made in Settings at once', () => {
    render(<ThemeApplier />);
    expect(html.className).toBe('');

    act(() => writeThemeChoice('aurora'));

    expect(html.className).toBe('aurora');
  });

  // Codex local review: Next keeps a visited page mounted but hidden. A
  // provider that held its own copy of the theme came back with the theme
  // from before the user changed it elsewhere. The applier reads storage when
  // it paints, so a stale render cannot repaint an old theme.
  it('paints the stored choice, not its last render, when it paints again', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const view = render(<ThemeApplier />);
    expect(html.className).toBe('dark');

    // Changed while this tree was hidden: storage moved on, no notification
    // reached this copy.
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    view.rerender(<ThemeApplier />);

    expect(html.className).toBe('');
  });

  it('follows a choice written in another tab', () => {
    render(<ThemeApplier />);

    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'dark');
      window.dispatchEvent(
        new StorageEvent('storage', { key: THEME_STORAGE_KEY })
      );
    });

    expect(html.className).toBe('dark');
  });
});

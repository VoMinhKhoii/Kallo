// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readThemeChoice } from '../theme-store';
import { THEME_STORAGE_KEY } from '../themes';

describe('readThemeChoice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete document.documentElement.dataset.unstoredTheme;
  });

  it('keeps an early choice when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    document.documentElement.dataset.unstoredTheme = 'dark';
    expect(readThemeChoice()).toBe('dark');
  });

  it('prefers a stored choice over an early one', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    document.documentElement.dataset.unstoredTheme = 'dark';
    expect(readThemeChoice()).toBe('light');
  });

  it('is System with nothing stored and no early choice', () => {
    expect(readThemeChoice()).toBe('system');
  });
});

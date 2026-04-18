import { describe, expect, it } from 'vitest';
import { resolveRootLocale } from './root-locale';

describe('resolveRootLocale', () => {
  it('prefers authenticated profile locale over cookie', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: true,
        profileLocale: 'vi',
        cookieLocale: 'en',
        defaultLocale: 'en',
      })
    ).toBe('vi');
  });

  it('falls back to cookie for unauthenticated users', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: false,
        profileLocale: 'vi',
        cookieLocale: 'en',
        defaultLocale: 'en',
      })
    ).toBe('en');
  });

  it('falls back to default when profile and cookie locales are absent', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: true,
        profileLocale: null,
        cookieLocale: null,
        defaultLocale: 'en',
      })
    ).toBe('en');
  });

  it('falls back to default when profile and cookie locales are invalid', () => {
    expect(
      resolveRootLocale({
        isAuthenticated: true,
        profileLocale: 'fr',
        cookieLocale: 'jp',
        defaultLocale: 'en',
      })
    ).toBe('en');
  });
});

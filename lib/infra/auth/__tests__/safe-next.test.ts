import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import { safeNextPath } from '@/lib/infra/auth/safe-next';

describe('safeNextPath', () => {
  it('accepts an in-app path under every configured locale', () => {
    for (const locale of locales) {
      expect(safeNextPath(`/${locale}`)).toBe(`/${locale}`);
      expect(safeNextPath(`/${locale}/logging?day=2026-11-28#top`)).toBe(
        `/${locale}/logging?day=2026-11-28#top`
      );
    }
  });

  it('refuses a path outside the configured locales', () => {
    expect(safeNextPath('/fr/logging')).toBeNull();
    expect(safeNextPath('/english')).toBeNull();
    expect(safeNextPath('/logging')).toBeNull();
    expect(safeNextPath('en/logging')).toBeNull();
  });

  it('refuses anything that could leave the site', () => {
    expect(safeNextPath('//evil.example/en')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath('https://evil.example/en')).toBeNull();
    expect(safeNextPath('/en/\\evil')).toBeNull();
    expect(safeNextPath('/en/a b')).toBeNull();
    expect(safeNextPath(`/en/${'a'.repeat(600)}`)).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

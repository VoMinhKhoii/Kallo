import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import { openGraphLocale } from '@/lib/seo/open-graph';

describe('openGraphLocale', () => {
  it('gives og:locale as language_TERRITORY, not the bare route locale', () => {
    expect(openGraphLocale('en')).toBe('en_US');
    expect(openGraphLocale('vi')).toBe('vi_VN');
  });

  it('covers every routed locale', () => {
    for (const locale of locales) {
      expect(openGraphLocale(locale), locale).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
  });
});

import { defaultLocale, type Locale, locales } from '@/i18n/config';
import { SITE_URL } from '@/lib/seo/site';

export type AlternateLanguages = Record<Locale | 'x-default', string>;

/**
 * Build one reciprocal, self-inclusive locale set for metadata and sitemaps.
 * x-default uses the prefixed default page because unprefixed paths redirect.
 */
export function alternateLanguages(path: string): AlternateLanguages {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, `${SITE_URL}/${locale}${path}`])
  ) as Record<Locale, string>;

  return {
    ...languages,
    'x-default': `${SITE_URL}/${defaultLocale}${path}`,
  };
}

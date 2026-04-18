import type { Locale } from '@/i18n/config';
import { locales } from '@/i18n/config';

interface ResolveRootLocaleArgs {
  isAuthenticated: boolean;
  profileLocale?: string | null;
  cookieLocale?: string | null;
  defaultLocale: Locale;
}

export function resolveRootLocale({
  isAuthenticated,
  profileLocale,
  cookieLocale,
  defaultLocale,
}: ResolveRootLocaleArgs): Locale {
  if (
    isAuthenticated &&
    profileLocale &&
    locales.includes(profileLocale as Locale)
  ) {
    return profileLocale as Locale;
  }

  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  return defaultLocale;
}

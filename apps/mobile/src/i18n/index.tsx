import * as Localization from 'expo-localization';
import en from './messages/en.json';
import vi from './messages/vi.json';

/**
 * Mobile i18n — the same `use-intl` core that powers the web's next-intl, fed
 * the same message catalogs (vendored from ../../messages via scripts/sync-i18n.mjs).
 * Components call `useTranslations('namespace')` exactly like the web, so a web
 * component ports over by swapping its `next-intl` import for `~/i18n`.
 *
 * The active locale is resolved in `locale-provider.tsx` (profile.preferredLocale
 * → device locale → 'en'); this module owns the catalogs + the device fallback.
 */

export const MESSAGES = { en, vi } as const;
export type AppLocale = keyof typeof MESSAGES;
const DEFAULT_LOCALE: AppLocale = 'en';

/** Device language → a supported locale (en/vi), defaulting to en. */
export function resolveDeviceLocale(): AppLocale {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === 'vi' ? 'vi' : DEFAULT_LOCALE;
}

export { useTranslations, useFormatter, useLocale, useNow } from 'use-intl';

import * as Localization from 'expo-localization';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { IntlProvider } from 'use-intl';
import en from './messages/en.json';
import vi from './messages/vi.json';

/**
 * Mobile i18n — the same `use-intl` core that powers the web's next-intl, fed
 * the same message catalogs (vendored from ../../messages via scripts/sync-i18n.mjs).
 * Components call `useTranslations('namespace')` exactly like the web, so a web
 * component ports over by swapping its `next-intl` import for `~/i18n`.
 */

const MESSAGES = { en, vi } as const;
export type AppLocale = keyof typeof MESSAGES;
const DEFAULT_LOCALE: AppLocale = 'en';

/** Device language → a supported locale (en/vi), defaulting to en. */
export function resolveDeviceLocale(): AppLocale {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === 'vi' ? 'vi' : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useMemo(resolveDeviceLocale, []);
  const timeZone = useMemo(
    () => Localization.getCalendars()[0]?.timeZone ?? undefined,
    []
  );

  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]} timeZone={timeZone}>
      {children}
    </IntlProvider>
  );
}

export { useTranslations, useFormatter, useLocale, useNow } from 'use-intl';

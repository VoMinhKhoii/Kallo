'use client';

import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeSwitchPath } from '@/lib/seo/locale-switch';

export function useLocaleSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  return (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    // Keep the query: the settings dialog lives in it (`?settings=`), and
    // switching language from inside it should leave it open.
    // A page with no twin in the other language (a dish, an English-only
    // page) switches to the nearest page that exists, not a 404.
    router.replace(
      `${localeSwitchPath(pathname, nextLocale)}${window.location.search}`,
      {
        locale: nextLocale,
      }
    );
  };
}

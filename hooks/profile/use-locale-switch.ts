'use client';

import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/navigation';
import { switchedFoodPath } from '@/lib/seo/food-pages/slugs';

export function useLocaleSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  return (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    // Keep the query: the settings dialog lives in it (`?settings=`), and
    // switching language from inside it should leave it open.
    // Food pages are per-locale dish lists: a dish with no twin in the other
    // language switches to that language's hub, not a 404.
    router.replace(
      `${switchedFoodPath(pathname, nextLocale)}${window.location.search}`,
      {
        locale: nextLocale,
      }
    );
  };
}

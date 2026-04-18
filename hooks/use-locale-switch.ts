'use client';

import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/navigation';

export function useLocaleSwitch() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();

  return (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
  };
}

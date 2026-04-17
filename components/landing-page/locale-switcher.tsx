'use client';

import { GB, VN } from 'country-flag-icons/react/3x2';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const LOCALES = [
  { code: 'en' as Locale, label: 'English', Flag: GB },
  { code: 'vi' as Locale, label: 'Tiếng Việt', Flag: VN },
];

export function LocaleSwitcher() {
  const t = useTranslations('landing.localeSwitcher');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (nextLocale: Locale) => {
    if (nextLocale === locale) return;

    startTransition(() => {
      // Save locale preference to cookie
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;

      // Navigate to the same pathname in the new locale
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <div
      role="group"
      className="flex items-center gap-2"
      aria-label={t('label')}
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {LOCALES.map(({ code, label, Flag }) => {
        const selected = code === locale;

        return (
          <button
            key={code}
            type="button"
            onClick={() => handleChange(code)}
            disabled={isPending}
            aria-pressed={selected}
            title={label}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
              selected
                ? 'border-[#C9A87C] bg-[#E8D5B5]/30 text-[#2C2416]'
                : 'border-[#E8D5B5]/50 bg-white/70 text-[#6B5D4F] hover:border-[#C9A87C]/60 hover:text-[#2C2416]',
              isPending && 'opacity-70'
            )}
          >
            <Flag className="h-3.5 w-5 rounded-[2px]" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { GB, VN } from 'country-flag-icons/react/3x2';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const LOCALES = [
  { code: 'en' as Locale, label: 'English', Flag: GB },
  { code: 'vi' as Locale, label: 'Tiếng Việt', Flag: VN },
];

export function LocaleSwitcher() {
  const t = useTranslations('landing.localeSwitcher');
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const switchLocale = useLocaleSwitch();
  const handleChange = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      return;
    }

    // Save locale preference to cookie
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    startTransition(() => switchLocale(nextLocale));
  };

  return (
    <div
      role="group"
      className="flex items-center gap-2 font-sans-display"
      aria-label={t('label')}
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
                ? 'border-nham-accent bg-nham-border/30 text-nham-text'
                : 'border-nham-border/50 bg-white/70 text-nham-text-soft hover:border-nham-accent/60 hover:text-nham-text',
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

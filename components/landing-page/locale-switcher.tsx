'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/ui/cn';

/**
 * Two locales, so the switch is two words rather than a control.
 *
 * It used to be a pair of bordered pills carrying national flag SVGs. Flags are
 * the wrong instrument twice over — a flag names a country, not a language, and
 * two of them in a header read as a settings widget somebody forgot to style.
 * What is left is the smallest thing that still says "you can read this in the
 * other one": the two codes, the current one in full ink, the other soft, and a
 * hairline between them doing the work the borders used to.
 */
const LOCALES = [
  { code: 'en' as Locale, short: 'EN', label: 'English' },
  { code: 'vi' as Locale, short: 'VI', label: 'Tiếng Việt' },
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
      className={cn(
        'flex items-center font-sans-display transition-opacity',
        isPending && 'opacity-60'
      )}
      aria-label={t('label')}
    >
      {LOCALES.map(({ code, short, label }, index) => {
        const selected = code === locale;

        return (
          <div className="flex items-center" key={code}>
            {index > 0 && (
              <span aria-hidden="true" className="h-3 w-px bg-kallo-border" />
            )}
            <button
              type="button"
              onClick={() => handleChange(code)}
              disabled={isPending}
              aria-pressed={selected}
              title={label}
              // The visible text is "EN" / "VI"; the accessible name has to
              // stay the language's own name, or a screen reader announces two
              // buttons called after country-ish abbreviations.
              aria-label={label}
              className={cn(
                'cursor-pointer px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] transition-colors disabled:cursor-wait',
                selected
                  ? 'font-semibold text-kallo-text'
                  : 'font-normal text-kallo-text-soft hover:text-kallo-text'
              )}
            >
              {short}
            </button>
          </div>
        );
      })}
    </div>
  );
}

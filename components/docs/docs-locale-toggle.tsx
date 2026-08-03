'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { useLocaleSwitch } from '@/hooks/profile/use-locale-switch';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const LOCALES: { code: Locale; short: string; label: string }[] = [
  { code: 'vi', short: 'VI', label: 'Tiếng Việt' },
  { code: 'en', short: 'EN', label: 'English' },
];

/**
 * A compact VI/EN toggle for the docs header.
 *
 * The landing page's flag-and-full-name switcher is too heavy for a docs bar,
 * but the switching behaviour is identical, so this reuses `useLocaleSwitch` —
 * which routes through next-intl's locale-stripped pathname and therefore
 * lands on the same page in the other language rather than dumping the reader
 * back at the docs home.
 *
 * Selected state is the beige wash plus semibold, matching every other
 * segmented control in the product.
 */
export function DocsLocaleToggle() {
  const locale = useLocale() as Locale;
  const switchLocale = useLocaleSwitch();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-nham-border bg-white p-0.5">
      {LOCALES.map(({ code, short, label }) => {
        const selected = code === locale;

        return (
          <button
            aria-label={label}
            aria-pressed={selected}
            className={cn(
              'rounded-md px-2 py-1 font-sans-display text-[11px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent',
              selected
                ? 'bg-nham-hover font-semibold text-nham-text'
                : 'text-nham-text-muted hover:text-nham-text',
              isPending && 'opacity-70'
            )}
            disabled={isPending || selected}
            key={code}
            onClick={() => startTransition(() => switchLocale(code))}
            type="button"
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

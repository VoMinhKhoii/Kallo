'use client';

import { useTranslations } from 'next-intl';
import { useThemeChoice } from '@/hooks/theme/use-theme-choice';
import { THEME_CHOICES } from '@/lib/core/theme/themes';
import { cn } from '@/lib/core/ui/cn';
import { THEME_ICONS } from './theme-icons';

/** The track the four Appearance icons sit in. */
export const SEGMENT_TRACK =
  'flex shrink-0 items-center gap-0.5 rounded-lg bg-kallo-track p-0.5';

/** One icon segment; the chosen one sits on the thumb, as in OptionStrip. */
export const SEGMENT =
  'flex size-7 items-center justify-center rounded-md text-kallo-text-muted outline-none transition-colors hover:text-kallo-text';
export const SEGMENT_ON = 'bg-kallo-thumb text-kallo-text shadow-sm';

/**
 * Appearance as four icon buttons (System, Light, Dark, Aurora) for places
 * with no room for the Settings dropdown. Each is named for screen readers
 * and on hover; a tap applies the theme at once.
 */
export function ThemeSegments({ className }: { className?: string }) {
  const t = useTranslations('settings.appearance');
  const [choice, setChoice] = useThemeChoice();

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={cn(SEGMENT_TRACK, className)}
    >
      {THEME_CHOICES.map((option) => {
        const Icon = THEME_ICONS[option];
        const on = option === choice;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            aria-label={t(option)}
            title={t(option)}
            onClick={() => setChoice(option)}
            className={cn(
              SEGMENT,
              'size-8 focus-visible:ring-2 focus-visible:ring-kallo-accent',
              on && SEGMENT_ON
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

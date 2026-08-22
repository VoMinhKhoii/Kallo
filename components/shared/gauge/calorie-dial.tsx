'use client';

import { useLocale, useTranslations } from 'next-intl';
import { GaugeDial, gaugeLine } from '@/components/shared/gauge/gauge-dial';
import type { Goal } from '@/lib/domain/onboarding/types';

/**
 * The calorie dial: the 240° arc with the day's figures in its mouth.
 *
 * WHICH figure is the headline depends on the user's goal. Cutting counts DOWN
 * — what is left is the number they act on — and everyone else counts UP,
 * because a bulking or maintaining user is trying to reach a figure, not stay
 * under one. Both numbers are always on screen; only the hierarchy moves, so
 * the layout never shifts when a user changes goal.
 *
 * A cutter is never shown a negative. Past target the headline reads 0 and the
 * overshoot is carried by the line underneath — the deficit is spent, and
 * "−341 remaining" is a riddle where "0" is a fact.
 *
 * The arc FILLS with consumption for every goal. Draining it for cutters was
 * considered and dropped: it would make "exactly on target" and "800 over"
 * render identically.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/calorie_dial.dart`.
 */

/** Big enough to hold a four-figure headline in its mouth. */
export const CALORIE_DIAL_RADIUS = 104;

/**
 * The embedded size, for a surface that draws the dial inside a fixed header
 * above a scrolling day rather than giving it the top of the page. Half the
 * radius, and the headline steps from the hero figure down to a value: at 52
 * the mouth is ~78px wide and a 44px "1,259" does not fit in it.
 */
export const COMPACT_CALORIE_DIAL_RADIUS = 52;

interface CalorieDialProps {
  logged: number;
  target: number;
  /** Null reads as counting up, the same as bulking and maintaining. */
  goal: Goal | null;
  variant?: 'full' | 'compact';
}

export function CalorieDial({
  logged,
  target,
  goal,
  variant = 'full',
}: CalorieDialProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const format = (value: number) => Math.round(value).toLocaleString(locale);
  const remaining = Math.round(target - logged);

  // The three lines are decided together so each goal reads as one piece rather
  // than as three conditionals that have to agree.
  const readout =
    goal === 'cutting'
      ? {
          headline: format(Math.max(0, remaining)),
          unit: t('kcalRemaining'),
          detail: t('loggedOfTarget', {
            logged: format(logged),
            target: format(target),
          }),
        }
      : {
          headline: format(logged),
          unit: t('caloriesLogged'),
          detail:
            remaining >= 0
              ? t('leftOfTarget', {
                  left: format(remaining),
                  target: format(target),
                })
              : t('overTargetBy', {
                  over: format(-remaining),
                  target: format(target),
                }),
        };

  return (
    <GaugeDial
      // The calorie mark's own colour, as on the week strip and the heatmap.
      fill="var(--kallo-accent)"
      primary={gaugeLine(
        variant === 'full' ? 'hero' : 'value',
        readout.headline
      )}
      progress={target > 0 ? logged / target : 0}
      radius={
        variant === 'full' ? CALORIE_DIAL_RADIUS : COMPACT_CALORIE_DIAL_RADIUS
      }
      secondary={gaugeLine('body', readout.unit)}
      tertiary={gaugeLine('meta', readout.detail)}
    />
  );
}

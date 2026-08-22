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
 * above a scrolling day rather than giving it the top of the page.
 *
 * Half the radius, the headline steps from the hero figure down to a value,
 * and both lower lines shorten. The radius forces that: on the tip line the
 * mouth is only ~0.56× the radius each side, so at 52 it holds ~58px and the
 * dock's "kcal remaining" measures ~100. The unit becomes one word, and the
 * detail drops to the bare fraction — figures and a slash, which every locale
 * renders at the same width, so a long translation cannot push the macro dials
 * beside it out of shape.
 *
 * This is the calorie ring's own composition, which this dial replaced: the
 * figure and a one-word label inside the mark, the day's arithmetic under it.
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

  const full = variant === 'full';
  // The compact dial's detail is the same fraction for every goal — the unit
  // word above it says which of the two figures the headline is.
  const progress = t('loggedOverTarget', {
    logged: format(logged),
    target: format(target),
  });

  // The three lines are decided together so each goal reads as one piece rather
  // than as three conditionals that have to agree.
  const readout =
    goal === 'cutting'
      ? {
          headline: format(Math.max(0, remaining)),
          unit: full ? t('kcalRemaining') : t('remainingShort'),
          detail: full
            ? t('loggedOfTarget', {
                logged: format(logged),
                target: format(target),
              })
            : progress,
        }
      : {
          headline: format(logged),
          unit: full ? t('caloriesLogged') : t('loggedShort'),
          detail: !full
            ? progress
            : remaining >= 0
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
      primary={gaugeLine(full ? 'hero' : 'value', readout.headline)}
      progress={target > 0 ? logged / target : 0}
      radius={full ? CALORIE_DIAL_RADIUS : COMPACT_CALORIE_DIAL_RADIUS}
      secondary={gaugeLine('body', readout.unit)}
      tertiary={gaugeLine('meta', readout.detail)}
    />
  );
}

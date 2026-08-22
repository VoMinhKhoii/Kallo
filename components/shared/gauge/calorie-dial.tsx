'use client';

import { useLocale, useTranslations } from 'next-intl';
import { GaugeDial } from '@/components/shared/gauge/gauge-dial';
import { gaugeLine } from '@/components/shared/gauge/gauge-lines';
import {
  type CalorieFraming,
  calorieReadout,
} from '@/lib/domain/nutrition/calorie-readout';
import type { Goal } from '@/lib/domain/onboarding/types';

/**
 * The calorie dial: the 240° arc with the day's figures in its mouth.
 *
 * WHICH figure leads is `calorieReadout`'s decision, not this file's — see
 * `lib/domain/nutrition/calorie-readout.ts` for the goal rule and why a cutter
 * is never shown a negative. This component's own job is the two axes of
 * PRESENTATION: the readout's framing picks the words, and the variant picks
 * how many of them there is room for.
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

/**
 * The word under the headline, per framing and per how much room there is.
 *
 * A table rather than a branch: the framing and the variant are independent
 * questions, and multiplying them into conditionals is what made this
 * unreadable the first time.
 */
const UNIT_KEY = {
  remaining: { full: 'kcalRemaining', compact: 'remainingShort' },
  logged: { full: 'caloriesLogged', compact: 'loggedShort' },
} as const satisfies Record<CalorieFraming, Record<Variant, string>>;

type Variant = 'full' | 'compact';

export function CalorieDial({
  logged,
  target,
  goal,
  variant = 'full',
}: CalorieDialProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const format = (value: number) => Math.round(value).toLocaleString(locale);

  const readout = calorieReadout(logged, target, goal);
  const fraction = { logged: format(logged), target: format(target) };
  const targetOnly = { target: format(target) };

  // The compact dial's detail is the same fraction for every goal — the unit
  // word above it says which of the two figures the headline is. The full dial
  // has room to say it in words.
  const detail =
    variant === 'compact'
      ? t('loggedOverTarget', fraction)
      : readout.framing === 'remaining'
        ? t('loggedOfTarget', fraction)
        : readout.over === null
          ? t('leftOfTarget', { left: format(readout.left), ...targetOnly })
          : t('overTargetBy', { over: format(readout.over), ...targetOnly });

  return (
    <GaugeDial
      // The calorie mark's own colour, as on the week strip and the heatmap.
      fill="var(--kallo-accent)"
      primary={gaugeLine(
        variant === 'full' ? 'hero' : 'value',
        format(readout.headline)
      )}
      progress={target > 0 ? logged / target : 0}
      radius={
        variant === 'full' ? CALORIE_DIAL_RADIUS : COMPACT_CALORIE_DIAL_RADIUS
      }
      secondary={gaugeLine('body', t(UNIT_KEY[readout.framing][variant]))}
      tertiary={gaugeLine('meta', detail)}
    />
  );
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { GaugeDial } from '@/components/shared/gauge/gauge-dial';
import { gaugeCalorieLines } from '@/components/shared/gauge/gauge-lines';
import { gaugeFitsLongUnit } from '@/lib/core/ui/gauge-figure-size';
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
 * PRESENTATION: the readout's framing picks the words, and the RADIUS picks how
 * many of them there is room for.
 *
 * The arc FILLS with consumption for every goal. Draining it for cutters was
 * considered and dropped: it would make "exactly on target" and "800 over"
 * render identically. Past target the dial wears the overshoot cap instead, and
 * the detail line carries the overshoot in terracotta.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/calorie_dial.dart`,
 * except that the radius is now handed in by `GaugeStrip` rather than picked
 * from two named variants.
 */

interface CalorieDialProps {
  logged: number;
  target: number;
  /** Null reads as counting up, the same as bulking and maintaining. */
  goal: Goal | null;
  /** Sized by the strip from the room the surface gave it. */
  radius: number;
}

/**
 * The word under the headline, per framing and per how much room there is.
 *
 * A table rather than a branch: the framing and the wording length are
 * independent questions, and multiplying them into conditionals is what made
 * this unreadable the first time.
 */
const UNIT_KEY = {
  remaining: { long: 'kcalRemaining', short: 'remainingShort' },
  logged: { long: 'caloriesLogged', short: 'loggedShort' },
} as const satisfies Record<CalorieFraming, Record<Wording, string>>;

type Wording = 'long' | 'short';

export function CalorieDial({
  logged,
  target,
  goal,
  radius,
}: CalorieDialProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const format = (value: number) => Math.round(value).toLocaleString(locale);

  const readout = calorieReadout(logged, target, goal);
  // Whether the words FIT, not how big the mark is — see `gaugeFitsLongUnit`.
  const wording: Wording = gaugeFitsLongUnit(radius) ? 'long' : 'short';
  const fraction = { logged: format(logged), target: format(target) };
  const targetOnly = { target: format(target) };

  // The detail line carries the OTHER figure: a cutter leads with what is left,
  // so the line under it says what was logged, and vice versa. The short dial's
  // detail is the same bare fraction for every goal — the unit word above it
  // already says which of the two the headline is.
  const detail =
    wording === 'short'
      ? t('loggedOverTarget', fraction)
      : readout.framing === 'remaining'
        ? t('loggedOfTarget', fraction)
        : readout.over === null
          ? t('leftOfTarget', { left: format(readout.left), ...targetOnly })
          : t('overTargetBy', { over: format(readout.over), ...targetOnly });

  const lines = gaugeCalorieLines(
    {
      figure: format(readout.headline),
      unit: t(UNIT_KEY[readout.framing][wording]),
      detail,
    },
    radius,
    readout.over !== null
  );

  return (
    <GaugeDial
      // The calorie mark's own colour, as on the week strip and the heatmap.
      fill="var(--kallo-accent)"
      progress={target > 0 ? logged / target : 0}
      radius={radius}
      {...lines}
    />
  );
}

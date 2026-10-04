'use client';

import { useTranslations } from 'next-intl';
import { CalorieDial } from '@/components/shared/gauge/calorie-dial';
import { MacroDial } from '@/components/shared/gauge/macro-dial';
import {
  COMPOSITION_KEYS,
  type CompositionKey,
  type MacroGrams,
} from '@/components/shared/nutrition/composition';
import {
  alignCentres,
  STACK_GAP,
  type StripLayout,
} from '@/lib/core/ui/gauge-strip-metrics';
import type { Goal } from '@/lib/domain/onboarding/types';

/** The day a strip draws. */
export interface StripDay {
  calories: { current: number; target: number };
  /** Grams eaten so far. */
  current: MacroGrams;
  /** Grams the day is aiming at. */
  target: MacroGrams;
  /** Which direction the user counts — the calorie readout follows it. */
  goal: Goal | null;
}

/** The label each dial wears, in the namespace every surface already reads. */
const LABEL_KEY: Record<CompositionKey, string> = {
  protein: 'protein',
  carbohydrate: 'carbs',
  fat: 'fat',
};

/**
 * The four marks at the sizes `GaugeStrip` measured for them — one row with
 * the arc centres aligned, or the calorie dial over the three macros.
 */
export function StripRow({
  calories,
  current,
  target,
  goal,
  sizes,
}: StripDay & { sizes: StripLayout }) {
  const t = useTranslations('dashboard');
  const { calorieRadius, macroRadius, gap, stacked } = sizes;
  const { calorieShift, macroShift } = alignCentres(sizes);

  const macros = COMPOSITION_KEYS.map((key) => (
    <MacroDial
      current={current[key]}
      dialKey={key}
      key={key}
      label={t(LABEL_KEY[key])}
      radius={macroRadius}
      target={target[key]}
    />
  ));

  const calorie = (
    <CalorieDial
      goal={goal}
      logged={calories.current}
      radius={calorieRadius}
      target={calories.target}
    />
  );

  // A card too narrow for four marks puts the calorie dial on its own line, the
  // three macros on the one below — the same marks and the same rule, only
  // wrapped. Nothing is resized to squeeze it.
  if (stacked) {
    return (
      <div
        className="flex flex-col items-center"
        data-testid="gauge-strip-stacked"
      >
        {calorie}
        <div
          className="flex w-full items-start justify-center"
          style={{ gap, marginTop: STACK_GAP }}
        >
          {macros}
        </div>
      </div>
    );
  }

  // The ARC CENTRES line up, not the boxes — see `alignCentres`.
  return (
    <div className="flex items-start justify-center" style={{ gap }}>
      <div style={{ marginTop: calorieShift }}>{calorie}</div>
      {macros.map((macro, index) => (
        <div key={COMPOSITION_KEYS[index]} style={{ marginTop: macroShift }}>
          {macro}
        </div>
      ))}
    </div>
  );
}

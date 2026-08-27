'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  sizeAtCap,
  sizeStrip,
  stripHeight,
} from '@/lib/core/ui/gauge-strip-metrics';
import type { Goal } from '@/lib/domain/onboarding/types';

/**
 * The day as one row of marks: the calorie dial, then the same arc in each
 * macro's own pigment.
 *
 * This owns all four, which is the point. They used to be two components that
 * happened to sit next to each other — a calorie dial, then a macro row inside
 * a `flex-1` box that centred its three fixed-size dials in whatever was left.
 * On a wide viewport that opened ~290px of nothing between them and grew with
 * the window. Sizing the whole cluster from one rule is what closes it: the
 * marks grow into the room until the surface's cap binds, and only then does
 * the cluster centre. See `lib/core/ui/gauge-strip-layout.ts` for how big, and
 * `gauge-strip-metrics.ts` for where they sit.
 *
 * Loosely mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/macro_dial_row.dart`,
 * which shrinks its dials to fit a narrow phone. This is the same idea with the
 * cap raised, so the marks also grow on a desktop.
 */

/**
 * The measurement wants to land before paint, but a layout effect warns when
 * React renders this on the server — where there is no layout to read anyway.
 * The server pass takes the effect-free branch and renders the spacer.
 */
const useMeasureEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The label each dial wears, in the namespace every surface already reads. */
const LABEL_KEY: Record<CompositionKey, string> = {
  protein: 'protein',
  carbohydrate: 'carbs',
  fat: 'fat',
};

interface GaugeStripProps {
  calories: { current: number; target: number };
  /** Grams eaten so far. */
  current: MacroGrams;
  /** Grams the day is aiming at. */
  target: MacroGrams;
  /** Which direction the user counts — the calorie readout follows it. */
  goal: Goal | null;
  /** This surface's ceiling on a macro dial's radius. */
  macroCap: number;
}

export function GaugeStrip({ macroCap, ...day }: GaugeStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);

  // Before paint, so the strip never renders at one size and visibly jumps to
  // another.
  useMeasureEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measure = (width: number) => {
      if (width > 0) {
        setAvailable((previous) => (previous === width ? previous : width));
      }
    };

    // Measure once up front: the observer's first callback is async in some
    // browsers, and an environment without layout never delivers one at all.
    measure(node.getBoundingClientRect().width || node.clientWidth);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      measure(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full" data-testid="gauge-strip" ref={containerRef}>
      {available === null ? (
        // Before the first measurement the strip reserves the height it will
        // take at this surface's cap, so nothing below it moves when it lands.
        <div style={{ height: stripHeight(sizeAtCap(macroCap)) }} />
      ) : (
        <StripRow {...day} sizes={sizeStrip(available, macroCap)} />
      )}
    </div>
  );
}

function StripRow({
  calories,
  current,
  target,
  goal,
  sizes,
}: Omit<GaugeStripProps, 'macroCap'> & { sizes: StripLayout }) {
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

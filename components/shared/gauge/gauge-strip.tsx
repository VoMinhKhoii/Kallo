'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalorieDial } from '@/components/shared/gauge/calorie-dial';
import { GaugeDial } from '@/components/shared/gauge/gauge-dial';
import {
  gaugeMacroLines,
  gaugeReadoutHeights,
} from '@/components/shared/gauge/gauge-lines';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  COMPOSITION_KEYS,
  type CompositionKey,
  type MacroGrams,
} from '@/components/shared/nutrition/composition';
import { gaugeMetaSize } from '@/lib/core/ui/gauge-figure-size';
import { gaugeReadoutLayout } from '@/lib/core/ui/gauge-readout-layout';
import {
  type GaugeStripSizes,
  gaugeStackedSizes,
  gaugeStripSizes,
} from '@/lib/core/ui/gauge-strip-layout';
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
 * the cluster centre. See `lib/core/ui/gauge-strip-layout.ts`.
 *
 * The glyph carries each macro's identity: pigment alone cannot separate three
 * arcs this small, and the beef / wheat / droplet set is already the app's
 * macro vocabulary on both platforms.
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

/** The gap between a macro's label and its arc. */
const LABEL_GAP = 2;

/** The break between the two rows when the strip wraps. */
const STACK_GAP = 20;

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

export function GaugeStrip({
  calories,
  current,
  target,
  goal,
  macroCap,
}: GaugeStripProps) {
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

  const sizes = available === null ? null : sizeStrip(available, macroCap);

  return (
    <div className="w-full" data-testid="gauge-strip" ref={containerRef}>
      {sizes === null ? (
        // Before the first measurement the strip reserves the height it will
        // take at this surface's cap, so nothing below it moves when it lands.
        <div style={{ height: stripHeight(sizeAtCap(macroCap)) }} />
      ) : (
        <StripRow
          calories={calories}
          current={current}
          goal={goal}
          sizes={sizes}
          target={target}
        />
      )}
    </div>
  );
}

/**
 * The biggest the strip can get on this surface — what an unmeasured render
 * reserves, since the cap is the ceiling however wide the column turns out.
 */
const sizeAtCap = (macroCap: number) =>
  sizeStrip(Number.POSITIVE_INFINITY, macroCap);

/** Four marks on one line, or — on a card too narrow for that — two. */
function sizeStrip(available: number, macroCap: number): StripLayout {
  const oneLine = gaugeStripSizes(available, macroCap);
  return oneLine.wraps
    ? { ...gaugeStackedSizes(available, macroCap), stacked: true }
    : { ...oneLine, stacked: false };
}

interface StripLayout extends GaugeStripSizes {
  stacked: boolean;
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

  // The ARC CENTRES line up, not the boxes. Each macro carries a label above its
  // arc, so top-aligning the cells drops every macro arc below the calorie
  // arc's centre line and the row reads as two unrelated rows of marks.
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

function MacroDial({
  dialKey,
  label,
  current,
  target,
  radius,
}: {
  dialKey: CompositionKey;
  label: string;
  current: number;
  target: number;
  radius: number;
}) {
  const color = COMPOSITION_COLORS[dialKey];
  const Icon = COMPOSITION_ICONS[dialKey];
  const labelSize = gaugeMetaSize(radius);
  const glyph = Math.max(12, Math.round(radius * 0.3));

  return (
    <div className="flex flex-col items-center">
      {/* The title sits ON the arc, not floating above it: the dial is drawn
          with no dead space over its stroke, so one tight gap binds them. */}
      <div
        className="flex items-center gap-1.5"
        style={{ height: labelLineHeight(radius) }}
      >
        <Icon
          aria-hidden="true"
          className="shrink-0"
          style={{ color, width: glyph, height: glyph }}
        />
        <span
          className="whitespace-nowrap font-medium font-sans-display text-kallo-text-muted uppercase tracking-[0.3px]"
          style={{
            fontSize: `${labelSize}px`,
            lineHeight: `${labelLineHeight(radius)}px`,
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ marginTop: LABEL_GAP }}>
        <GaugeDial
          fill={color}
          progress={target > 0 ? current / target : 0}
          radius={radius}
          {...gaugeMacroLines(
            {
              figure: `${Math.round(current)}g`,
              target: `/${Math.round(target)}g`,
            },
            radius
          )}
        />
      </div>
    </div>
  );
}

const labelLineHeight = (radius: number) =>
  Math.round(gaugeMetaSize(radius) * 1.3);

/**
 * How far each side of the row drops so the two arcs share a centre line.
 *
 * Only one of the two is ever non-zero — whichever mark's centre sits higher in
 * its own box gets pushed down to meet the other.
 */
function alignCentres(
  sizes: Pick<StripLayout, 'calorieRadius' | 'macroRadius'>
) {
  const { calorieRadius, macroRadius } = sizes;
  const calorieCentre =
    gaugeReadoutLayout(
      calorieRadius,
      gaugeReadoutHeights(calorieRadius, 'calorie')
    ).arcTop + calorieRadius;
  const macroCentre =
    labelLineHeight(macroRadius) +
    LABEL_GAP +
    gaugeReadoutLayout(macroRadius, gaugeReadoutHeights(macroRadius, 'macro'))
      .arcTop +
    macroRadius;

  return {
    calorieShift: Math.max(0, macroCentre - calorieCentre),
    macroShift: Math.max(0, calorieCentre - macroCentre),
  };
}

/** What the row measures once both sides are aligned — the skeleton's height. */
function stripHeight(sizes: StripLayout): number {
  const { calorieRadius, macroRadius, stacked } = sizes;
  const calorie = gaugeReadoutLayout(
    calorieRadius,
    gaugeReadoutHeights(calorieRadius, 'calorie')
  ).height;
  const macro =
    labelLineHeight(macroRadius) +
    LABEL_GAP +
    gaugeReadoutLayout(macroRadius, gaugeReadoutHeights(macroRadius, 'macro'))
      .height;

  if (stacked) return calorie + STACK_GAP + macro;
  const { calorieShift, macroShift } = alignCentres(sizes);
  return Math.max(calorieShift + calorie, macroShift + macro);
}

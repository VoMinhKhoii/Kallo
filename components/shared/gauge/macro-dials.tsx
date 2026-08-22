'use client';

import { GaugeDial, gaugeLine } from '@/components/shared/gauge/gauge-dial';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  type CompositionKey,
} from '@/components/shared/nutrition/composition';

/**
 * The three macro dials — the same arc as the calorie dial, a third of the
 * size, in each macro's own pigment.
 *
 * Replaces the labelled progress bars the dock and the logging header used to
 * draw. A bar reads its value against a track running the full width of the
 * surface, which put three long horizontal rules beside a round dial and made
 * the two halves look unrelated. The dial repeats the calorie mark's shape, so
 * the section reads as one family of objects.
 *
 * The glyph carries the identity: pigment alone cannot separate three arcs this
 * small, and the beef / wheat / droplet set is already the app's macro
 * vocabulary on both platforms.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/gauge/macro_dial_row.dart`.
 */

export const MACRO_DIAL_RADIUS = 44;
export const COMPACT_MACRO_DIAL_RADIUS = 30;

export interface MacroDialDatum {
  /** Picks the glyph and the pigment. */
  key: CompositionKey;
  label: string;
  current: number;
  target: number;
}

interface MacroDialsProps {
  macros: MacroDialDatum[];
  variant?: 'full' | 'compact';
}

export function MacroDials({ macros, variant = 'full' }: MacroDialsProps) {
  const radius =
    variant === 'full' ? MACRO_DIAL_RADIUS : COMPACT_MACRO_DIAL_RADIUS;

  return (
    // The dials hold their size and the ROW gives way: a dial scaled down with
    // its container would take its type with it, and a gram figure has a floor
    // the arc does not. On a viewport too narrow for three of them side by side
    // they wrap instead, which costs a line of height only where there was
    // never room for the row.
    <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-3">
      {macros.map((macro) => (
        <MacroDial data={macro} key={macro.key} radius={radius} />
      ))}
    </div>
  );
}

function MacroDial({ data, radius }: { data: MacroDialDatum; radius: number }) {
  const color = COMPOSITION_COLORS[data.key];
  const Icon = COMPOSITION_ICONS[data.key];

  return (
    <div className="flex flex-col items-center">
      {/* The title sits ON the arc, not floating above it: the dial is drawn
          with no dead space over its stroke, so one tight gap binds them. */}
      <div className="flex items-center gap-1.5">
        <Icon
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0"
          style={{ color }}
        />
        <span className="eyebrow whitespace-nowrap">{data.label}</span>
      </div>
      <div className="mt-0.5">
        <GaugeDial
          fill={color}
          primary={gaugeLine('value', `${Math.round(data.current)}g`)}
          progress={data.target > 0 ? data.current / data.target : 0}
          radius={radius}
          secondary={gaugeLine('meta', `/${Math.round(data.target)}g`)}
        />
      </div>
    </div>
  );
}

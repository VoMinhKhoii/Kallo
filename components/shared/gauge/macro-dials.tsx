'use client';

import { useTranslations } from 'next-intl';
import { GaugeDial } from '@/components/shared/gauge/gauge-dial';
import { gaugeLine } from '@/components/shared/gauge/gauge-lines';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  COMPOSITION_KEYS,
  type CompositionKey,
  type MacroGrams,
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

const MACRO_DIAL_RADIUS = 44;
export const COMPACT_MACRO_DIAL_RADIUS = 30;

/** The label each dial wears, in the namespace every surface already reads. */
const LABEL_KEY: Record<CompositionKey, string> = {
  protein: 'protein',
  carbohydrate: 'carbs',
  fat: 'fat',
};

interface MacroDialsProps {
  /** Grams eaten so far. */
  current: MacroGrams;
  /** Grams the day is aiming at. */
  target: MacroGrams;
  variant?: 'full' | 'compact';
}

/**
 * The row owns the keys, the pigments, the glyphs AND the labels, so a surface
 * that wants dials hands over two records and nothing else. Every caller used
 * to spell the same three-row table itself, which is three chances to disagree
 * about what "carbs" is called.
 */
export function MacroDials({
  current,
  target,
  variant = 'full',
}: MacroDialsProps) {
  const t = useTranslations('dashboard');
  const radius =
    variant === 'full' ? MACRO_DIAL_RADIUS : COMPACT_MACRO_DIAL_RADIUS;

  return (
    // The dials hold their size and the ROW gives way: a dial scaled down with
    // its container would take its type with it, and a gram figure has a floor
    // the arc does not. On a viewport too narrow for three of them side by side
    // they wrap instead, which costs a line of height only where there was
    // never room for the row.
    <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-3">
      {COMPOSITION_KEYS.map((key) => (
        <MacroDial
          current={current[key]}
          dialKey={key}
          key={key}
          label={t(LABEL_KEY[key])}
          radius={radius}
          target={target[key]}
        />
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
        <span className="eyebrow whitespace-nowrap">{label}</span>
      </div>
      <div className="mt-0.5">
        <GaugeDial
          fill={color}
          primary={gaugeLine('value', `${Math.round(current)}g`)}
          progress={target > 0 ? current / target : 0}
          radius={radius}
          secondary={gaugeLine('meta', `/${Math.round(target)}g`)}
        />
      </div>
    </div>
  );
}

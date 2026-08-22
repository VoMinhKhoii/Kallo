'use client';

import { useLocale } from 'next-intl';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  COMPOSITION_KEYS,
  type CompositionKey,
} from '@/components/shared/nutrition/composition';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import { cn } from '@/lib/core/ui/cn';

/**
 * The macro figures that sit under a `CompositionBar`: a food glyph in each
 * macro's pigment, then its grams.
 *
 * The three sit at evenly-surrounded positions rather than tracking the bar's
 * segment widths. Mirroring the segment widths read well on an even split and
 * fell apart on a lopsided one: a 7%-protein meal gives a ~22px cell that
 * cannot hold "P: 4g", so the label scaled toward illegible while the far one
 * jammed against the edge. A figure the reader cannot read is worth less than
 * one that has moved away from its colour — the pigment on each glyph is what
 * still ties a figure to its segment.
 *
 * Mirrors `apps/mobile-flutter/lib/shared/widgets/nutrition/macro_scale.dart`.
 */

const LABELS: Record<CompositionKey, string> = {
  protein: 'P',
  carbohydrate: 'C',
  fat: 'F',
};

interface MacroScaleProps {
  /** Grams. Null is a macro that was never measured, and shows as an em dash
   * rather than a confident zero. */
  protein: number | null;
  carbohydrate: number | null;
  fat: number | null;
  className?: string;
}

export function MacroScale({
  protein,
  carbohydrate,
  fat,
  className,
}: MacroScaleProps) {
  const locale = useLocale();
  const grams: Record<CompositionKey, number | null> = {
    protein,
    carbohydrate,
    fat,
  };

  return (
    <div className={cn('flex items-center justify-evenly gap-2', className)}>
      {COMPOSITION_KEYS.map((key) => {
        const Icon = COMPOSITION_ICONS[key];
        const value = grams[key];

        return (
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-kallo-text text-xs tabular-nums"
            key={key}
          >
            <Icon
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: COMPOSITION_COLORS[key] }}
            />
            {LABELS[key]}:{' '}
            {value == null ? '—' : `${formatLocalizedNumber(value, locale)}g`}
          </span>
        );
      })}
    </div>
  );
}

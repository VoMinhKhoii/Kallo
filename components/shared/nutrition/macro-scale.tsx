'use client';

import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
  COMPOSITION_KEYS,
  type CompositionKey,
  type MacroGramsInput,
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
  /**
   * Grams per macro — the same record `compositionFromGrams` takes, so a row
   * drawing both spells the three field names once.
   *
   * Null is a macro that was never measured, and shows as an em dash rather
   * than a confident zero.
   */
  grams: MacroGramsInput;
  /**
   * A figure that leads the row — the meal's kcal, on the surfaces that put it
   * there. Four items no longer divide the row into equal cells the way three
   * do, so the row switches to end-to-end distribution, which is what mobile's
   * `MealBlock` legend does with the same four (`spaceBetween`).
   */
  leading?: ReactNode;
  /**
   * A figure that closes the row — the meal's kcal after its macros, as the
   * logging card reads (mobile's `MealBlockKcal.legendTrailing`). Distributes
   * the row end to end, as `leading` does.
   */
  trailing?: ReactNode;
  /**
   * `columns` (no `leading` / `trailing`): three equal columns, each figure centred in its
   * own, so the space either side of every figure is the same and their
   * positions never move with the numbers — the owner's ruling for the meal
   * edit dialog ("left space of P must equal right space of P"). Mirrors
   * mobile's `MacroLegend`.
   */
  spread?: 'even' | 'columns';
  className?: string;
}

export function MacroScale({
  grams,
  leading,
  trailing,
  spread = 'even',
  className,
}: MacroScaleProps) {
  const locale = useLocale();
  const edged = leading != null || trailing != null;
  const columns = spread === 'columns' && !edged;

  return (
    <div
      className={cn(
        columns
          ? 'grid grid-cols-3 items-center justify-items-center'
          : 'flex items-center gap-2',
        !columns && (edged ? 'justify-between' : 'justify-evenly'),
        className
      )}
    >
      {leading}
      {COMPOSITION_KEYS.map((key) => {
        const Icon = COMPOSITION_ICONS[key];
        const value = grams[key] ?? null;

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
      {trailing}
    </div>
  );
}

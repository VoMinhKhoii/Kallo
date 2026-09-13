'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/core/ui/cn';
import {
  HEATMAP_CELL_PAINTS,
  HEATMAP_CELL_RADIUS_CLASS,
  type HeatmapCellPaint,
  heatmapLegendSwatches,
  heatmapTierPaint,
} from './heatmap-colors';

/**
 * The heatmap's key.
 *
 * Split out of `adherence-heatmap.tsx` when the scale stopped being a gradient:
 * a continuous bar with only its two ends named was the shape that let the old
 * five-tier scale over-promise, since the under-target half it implied could
 * never actually paint. Discrete swatches with words cannot make a claim the
 * cells do not honour.
 *
 * The ramp is one group — it IS a single idea, "how much of the goal" — and the
 * three off-ramp cells follow as their own named items, because none of them is
 * a step on that ramp. Every kind of cell the grid can paint is named here: a
 * key that omits one is a key that quietly reclassifies it as something else.
 */
export function HeatmapLegend({ numWeeks }: { numWeeks: number }) {
  const t = useTranslations('dashboard.adherenceHeatmap');

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2"
      style={{ gridRow: 9, gridColumn: `2 / span ${numWeeks}` }}
    >
      <span className="flex items-center gap-2">
        <span className="text-kallo-text-muted text-xs">{t('notLogged')}</span>
        <span className="flex items-center gap-[3px]">
          {heatmapLegendSwatches().map((swatch) => (
            <Swatch key={swatch} paint={{ backgroundColor: swatch }} />
          ))}
        </span>
        <span className="text-kallo-text-muted text-xs">{t('onTarget')}</span>
      </span>
      {/* Each item asks the palette for the paint of the kind it names, rather
          than assembling one from the raw tokens — assembling is what let this
          key omit two cell kinds and draw a third wrongly. */}
      <LegendItem
        label={t('overTarget')}
        paint={heatmapTierPaint('overTarget')}
      />
      <LegendItem label={t('cheatDay')} paint={HEATMAP_CELL_PAINTS.cheat} />
      <LegendItem label={t('partial')} paint={HEATMAP_CELL_PAINTS.awaiting} />
    </div>
  );
}

/** One cell, drawn as a swatch — same paint record the grid cell consumes. */
function Swatch({ paint }: { paint: HeatmapCellPaint }) {
  return (
    <span
      className={cn('size-3', HEATMAP_CELL_RADIUS_CLASS, paint.ringClass)}
      style={{
        backgroundColor: paint.backgroundColor,
        backgroundImage: paint.backgroundImage,
      }}
    />
  );
}

function LegendItem({
  label,
  paint,
}: {
  label: string;
  paint: HeatmapCellPaint;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Swatch paint={paint} />
      <span className="text-kallo-text-muted text-xs">{label}</span>
    </span>
  );
}

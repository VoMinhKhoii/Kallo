'use client';

import { useTranslations } from 'next-intl';
import { HEATMAP_COLORS, heatmapLegendSwatches } from './heatmap-colors';

/**
 * The heatmap's key.
 *
 * Split out of `adherence-heatmap.tsx` when the scale stopped being a gradient:
 * a continuous bar with only its two ends named was the shape that let the old
 * five-tier scale over-promise, since the under-target half it implied could
 * never actually paint. Discrete swatches with words cannot make a claim the
 * cells do not honour.
 *
 * The ramp is one group — it IS a single idea, "how much of the goal" — and
 * over-target follows as its own named item, because it is not a step on that
 * ramp.
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
            <span
              className="size-3 rounded-[3px]"
              key={swatch}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </span>
        <span className="text-kallo-text-muted text-xs">{t('onTarget')}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="size-3 rounded-[3px]"
          style={{ backgroundColor: HEATMAP_COLORS.over }}
        />
        <span className="text-kallo-text-muted text-xs">{t('overTarget')}</span>
      </span>
    </div>
  );
}

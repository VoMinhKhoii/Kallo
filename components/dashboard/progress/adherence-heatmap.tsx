'use client';

import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimeRange } from '@/components/dashboard/types';
import { getHeatmapColor, HEATMAP_COLORS } from '@/components/dashboard/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const GAP: Record<TimeRange, number> = { '30d': 3, '90d': 2 };

interface AdherenceHeatmapProps {
  /** Transposed: 7 rows (M→S) × N columns (weeks) */
  data: (number | null)[][];
  range: TimeRange;
}

export function AdherenceHeatmap({ data, range }: AdherenceHeatmapProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [sq, setSq] = useState(19);

  const adherenceRate = useMemo(() => {
    let onTarget = 0;
    let total = 0;
    for (const row of data) {
      for (const val of row) {
        if (val !== null) {
          total++;
          if (Math.abs(val - 1.0) <= 0.1) onTarget++;
        }
      }
    }
    return total > 0 ? Math.round((onTarget / total) * 100) : 0;
  }, [data]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      if (h > 0) {
        const gap = GAP[range];
        const newSq = Math.floor((h - 6 * gap) / 7);
        setSq(Math.max(10, newSq));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [range]);

  const gap = GAP[range];
  const numWeeks = data[0]?.length ?? 0;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="shrink-0 font-mono text-nham-text-muted text-xs">
            <span className="font-semibold text-nham-text">
              {adherenceRate}%
            </span>{' '}
            on track
          </span>
        </div>

        {/* Grid — height-constrained, naturally-sized width */}
        <div ref={gridRef} className="flex flex-1 items-center gap-1">
          {/* Day labels */}
          <div className="flex shrink-0 flex-col" style={{ gap: `${gap}px` }}>
            {DAY_LABELS.map((d, i) => (
              <div
                key={`lbl-${i}`}
                className="flex items-center justify-end pr-1 text-[9px] text-nham-stone"
                style={{ height: `${sq}px` }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells — fixed pixel squares */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${numWeeks}, ${sq}px)`,
              gridTemplateRows: `repeat(7, ${sq}px)`,
              gap: `${gap}px`,
              gridAutoFlow: 'column',
            }}
          >
            {Array.from({ length: numWeeks }, (_, wi) =>
              data.map((dayRow, di) => {
                const val = dayRow[wi] ?? null;
                const { bg, label } = getHeatmapColor(val);
                const isNull = val === null;
                const tooltipText = isNull
                  ? 'Not logged'
                  : `${label} · ${Math.round((val ?? 0) * 100)}%`;

                return (
                  <Tooltip key={`${di}-${wi}`}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        aria-label={tooltipText}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.2,
                          delay: wi * 0.02 + di * 0.01,
                        }}
                        className="relative cursor-default rounded-[3px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/60"
                        style={{ backgroundColor: isNull ? undefined : bg }}
                      >
                        {isNull && (
                          <div className="absolute inset-0 rounded-[3px] border border-nham-border/40 border-dashed" />
                        )}
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="bg-nham-text text-[10px] text-white"
                    >
                      {tooltipText}
                    </TooltipContent>
                  </Tooltip>
                );
              })
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[9px] text-nham-stone">Off target</span>
          <div
            className="h-1.5 flex-1 rounded-full"
            style={{
              background: `linear-gradient(to right, ${HEATMAP_COLORS.far}, ${HEATMAP_COLORS.moderate}, ${HEATMAP_COLORS.slight}, ${HEATMAP_COLORS.close}, ${HEATMAP_COLORS.onTarget})`,
            }}
          />
          <span className="text-[9px] text-nham-stone">On target</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

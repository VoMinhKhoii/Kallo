'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  HeatmapCell,
  HeatmapData,
  HeatmapRange,
} from '@/lib/types/dashboard';
import { getHeatmapColor, HEATMAP_COLORS } from './heatmap-colors';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const GAP: Record<HeatmapRange, number> = { '30d': 3, '90d': 2, year: 1 };
const DAY_LABEL_WIDTH = 16;
const HEATMAP_VERTICAL_CHROME = 32;

interface AdherenceHeatmapProps {
  data: HeatmapData;
  range: HeatmapRange;
}

export function AdherenceHeatmap({ data, range }: AdherenceHeatmapProps) {
  const t = useTranslations('dashboard.adherenceHeatmap');
  const gridRef = useRef<HTMLDivElement>(null);
  const [sq, setSq] = useState(19);

  const adherenceRate = useMemo(() => {
    let onTarget = 0;
    let total = 0;
    for (const row of data.cells) {
      for (const cell of row) {
        if (cell.status === 'logged' && cell.ratio !== null) {
          total++;
          if (Math.abs(cell.ratio - 1.0) <= 0.1) onTarget++;
        }
      }
    }
    return total > 0 ? Math.round((onTarget / total) * 100) : 0;
  }, [data]);

  const gap = GAP[range];
  const numWeeks = data.cells[0]?.length ?? 0;
  const heatmapWidth =
    numWeeks > 0 ? numWeeks * sq + Math.max(0, numWeeks - 1) * gap : 0;

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      const height = entries[0]?.contentRect.height ?? 0;
      if (width > 0 && height > 0 && numWeeks > 0) {
        const gap = GAP[range];
        const widthSq = Math.floor(
          (width - DAY_LABEL_WIDTH - 6 - Math.max(0, numWeeks - 1) * gap) /
            numWeeks
        );
        const heightSq = Math.floor(
          (height - HEATMAP_VERTICAL_CHROME - 6 * gap) / 7
        );
        setSq(Math.max(10, Math.min(widthSq, heightSq)));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [numWeeks, range]);

  const getTooltipText = (cell: HeatmapCell) => {
    if (cell.status === 'future') return t('future');
    if (cell.status === 'outside') return t('outside');
    if (cell.status !== 'logged' || cell.ratio === null) return t('notLogged');

    const { labelKey } = getHeatmapColor(cell.ratio);
    return `${t(labelKey)} · ${Math.round(cell.ratio * 100)}%`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="shrink-0 font-mono text-nham-text-muted text-xs">
            {t('onTrack', { percent: adherenceRate })}
          </span>
        </div>

        <div ref={gridRef} className="flex min-h-0 flex-1 items-center gap-1">
          {/* Day labels */}
          <div className="flex shrink-0 flex-col" style={{ gap: `${gap}px` }}>
            {DAY_LABELS.map((d, i) => (
              <div
                key={`lbl-${i}`}
                className="flex items-center justify-end pr-1 font-semibold text-[10px] text-nham-text-muted"
                style={{ height: `${sq}px` }}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="min-w-0 overflow-hidden">
            <div
              className="relative mb-1 h-4 font-semibold text-[10px] text-nham-text-muted"
              style={{ width: `${heatmapWidth}px` }}
            >
              {data.monthHeaders.map((header) => (
                <span
                  key={`${header.month}-${header.startColumn}`}
                  className="absolute top-0 truncate"
                  style={{
                    left: `${header.startColumn * (sq + gap)}px`,
                    width: `${header.span * sq + Math.max(0, header.span - 1) * gap}px`,
                  }}
                >
                  {header.month}
                </span>
              ))}
            </div>

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
                data.cells.map((dayRow, di) => {
                  const cell = dayRow[wi];
                  const ratio = cell?.ratio ?? null;
                  const { bg } = getHeatmapColor(ratio);
                  const isLogged = cell?.status === 'logged' && ratio !== null;
                  const isMuted =
                    cell?.status === 'future' || cell?.status === 'outside';
                  const isFocusable = isLogged && !isMuted;
                  const tooltipText = cell
                    ? getTooltipText(cell)
                    : t('notLogged');

                  return (
                    <Tooltip key={`${di}-${wi}`}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          aria-label={tooltipText}
                          aria-disabled={!isFocusable}
                          tabIndex={isFocusable ? 0 : -1}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.16,
                            delay: wi * 0.01 + di * 0.005,
                          }}
                          className="relative cursor-default rounded-[3px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/60"
                          style={{ backgroundColor: isLogged ? bg : undefined }}
                        >
                          {!isLogged && (
                            <div
                              className={
                                isMuted
                                  ? 'absolute inset-0 rounded-[3px] bg-nham-track/55 opacity-70'
                                  : 'absolute inset-0 rounded-[3px] border border-nham-border bg-nham-track/30'
                              }
                            />
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
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[9px] text-nham-stone">{t('offTarget')}</span>
          <div
            className="h-1.5 flex-1 rounded-full"
            style={{
              background: `linear-gradient(to right, ${HEATMAP_COLORS.far}, ${HEATMAP_COLORS.moderate}, ${HEATMAP_COLORS.slight}, ${HEATMAP_COLORS.close}, ${HEATMAP_COLORS.onTarget})`,
            }}
          />
          <span className="text-[9px] text-nham-stone">{t('onTarget')}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}

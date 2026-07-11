'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { getHeatmapColor, HEATMAP_COLORS } from './heatmap-colors';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const GAP: Record<HeatmapRange, number> = { '30d': 3, '90d': 2, year: 1 };
const DAY_LABEL_WIDTH = 16;
// Left inset that aligns the month headers and the legend with the first
// week column: the day-label gutter plus the gap-1 (4px) beside it.
const GRID_LEFT_INSET = DAY_LABEL_WIDTH + 4;
// Month-header row (20) + legend row (~24) + slack, all inside the measured
// container now that the legend travels with the centered grid cluster.
const HEATMAP_VERTICAL_CHROME = 56;

interface AdherenceHeatmapProps {
  data: HeatmapData;
  range: HeatmapRange;
}

export function AdherenceHeatmap({ data, range }: AdherenceHeatmapProps) {
  const t = useTranslations('dashboard.adherenceHeatmap');
  const gridRef = useRef<HTMLDivElement>(null);
  const [sq, setSq] = useState(19);
  // The 'year' range stagger fires up to 371 cells. Honour the OS-level
  // reduced-motion preference so users with vestibular-motion sensitivity
  // don't get a wall of moving cells. They still see the final state.
  const prefersReducedMotion = useReducedMotion();

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
    if (cell.status === 'partial') return t('partial');
    if (cell.status !== 'logged' || cell.ratio === null) return t('notLogged');

    if (cell.hasCheatMeal) return t('cheatDay');
    const { labelKey } = getHeatmapColor(cell.ratio);
    return `${t(labelKey)} · ${Math.round(cell.ratio * 100)}%`;
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-full flex-col">
        {/* The month-header row and the label+grid row live in one column so
            the whole block centers vertically as a unit, while the day labels
            sit in a fixed-width gutter that keeps them level with the rows. */}
        <div
          ref={gridRef}
          className="flex min-h-0 flex-1 flex-col justify-center"
        >
          <div className="min-w-0">
            <div
              className="relative mb-1 h-4 font-medium text-nham-text-muted text-xs"
              style={{
                width: `${heatmapWidth}px`,
                marginLeft: `${GRID_LEFT_INSET}px`,
              }}
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

            <div className="flex gap-1">
              {/* Day labels */}
              <div
                className="flex shrink-0 flex-col"
                style={{ width: `${DAY_LABEL_WIDTH}px`, gap: `${gap}px` }}
              >
                {DAY_LABELS.map((d, i) => (
                  <div
                    key={`lbl-${i}`}
                    className="flex items-center justify-end pr-1 font-medium text-nham-text-muted text-xs"
                    style={{ height: `${sq}px` }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              <div className="min-w-0 overflow-hidden">
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
                      const isLogged =
                        cell?.status === 'logged' && ratio !== null;
                      const isCheat = isLogged && Boolean(cell?.hasCheatMeal);
                      const isPartial = cell?.status === 'partial';
                      const isMuted =
                        cell?.status === 'future' || cell?.status === 'outside';
                      const isFocusable = (isLogged || isPartial) && !isMuted;
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
                              initial={
                                prefersReducedMotion
                                  ? false
                                  : { opacity: 0, scale: 0.6 }
                              }
                              animate={{ opacity: 1, scale: 1 }}
                              transition={
                                prefersReducedMotion
                                  ? { duration: 0 }
                                  : {
                                      duration: 0.16,
                                      delay: wi * 0.01 + di * 0.005,
                                    }
                              }
                              className={cn(
                                'relative cursor-default rounded-[3px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/60',
                                // Cheat day: a calm warm ring instead of intensity
                                // grading — recognizable, never red.
                                isCheat && 'ring-1 ring-nham-cheat ring-inset'
                              )}
                              style={{
                                backgroundColor: isCheat
                                  ? 'var(--nham-cheat-fill)'
                                  : isLogged
                                    ? bg
                                    : undefined,
                              }}
                            >
                              {!isLogged && (
                                <div
                                  className={cn(
                                    'absolute inset-0 rounded-[3px]',
                                    isMuted
                                      ? 'bg-nham-track/55 opacity-70'
                                      : 'bg-nham-track/30',
                                    isPartial && 'border border-nham-border'
                                  )}
                                />
                              )}
                              {isCheat && (
                                <span
                                  aria-hidden
                                  className="absolute inset-0 flex items-center justify-center text-[8px] text-nham-cheat"
                                >
                                  ●
                                </span>
                              )}
                            </motion.button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="bg-nham-text text-nham-surface text-xs"
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

            {/* Legend — travels with the grid cluster and matches its width,
                so the card reads as one centered block instead of a grid
                floating above a full-width bar. */}
            <div
              className="mt-3 flex items-center gap-2"
              style={{
                width: `${heatmapWidth}px`,
                marginLeft: `${GRID_LEFT_INSET}px`,
              }}
            >
              <span className="text-nham-text-muted text-xs">
                {t('offTarget')}
              </span>
              <div
                className="h-1.5 flex-1 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${HEATMAP_COLORS.far}, ${HEATMAP_COLORS.moderate}, ${HEATMAP_COLORS.slight}, ${HEATMAP_COLORS.close}, ${HEATMAP_COLORS.onTarget})`,
                }}
              />
              <span className="text-nham-text-muted text-xs">
                {t('onTarget')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

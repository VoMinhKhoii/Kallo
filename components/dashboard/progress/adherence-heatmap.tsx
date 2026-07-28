'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
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
import { getHeatmapColor, heatmapLegendGradient } from './heatmap-colors';
import { HeatmapMonthHeaderRow } from './heatmap-month-headers';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const GAP: Record<HeatmapRange, number> = { '30d': 3, '90d': 2, year: 1 };
const DAY_LABEL_COL = 20;
// Ceiling per range so a wide card can't inflate sparse grids (a 5-column
// 30d grid at full width would be comically tall). The year grid never hits
// its cap inside the 1440px-capped dashboard, so it always spans the card.
const MAX_SQ: Record<HeatmapRange, number> = { '30d': 32, '90d': 24, year: 28 };

interface AdherenceHeatmapProps {
  data: HeatmapData;
  range: HeatmapRange;
}

/**
 * One CSS grid carries everything — the day-label gutter, the month headers,
 * the cells, and the legend — with `1fr` week columns, so the grid always
 * spans the card's width (sidebar collapsed or not) and the `aspect-square`
 * cells keep themselves square, sizing the rows. No measurement code.
 */
export function AdherenceHeatmap({ data, range }: AdherenceHeatmapProps) {
  const t = useTranslations('dashboard.adherenceHeatmap');
  // The 'year' range stagger fires up to 371 cells. Honour the OS-level
  // reduced-motion preference so users with vestibular-motion sensitivity
  // don't get a wall of moving cells. They still see the final state.
  const prefersReducedMotion = useReducedMotion();

  const gap = GAP[range];
  const numWeeks = data.cells[0]?.length ?? 0;

  const getTooltipText = (cell: HeatmapCell) => {
    if (cell.status === 'future') return t('future');
    if (cell.status === 'outside') return t('outside');
    if (cell.status === 'partial') return t('partial');
    if (cell.status !== 'logged' || cell.ratio === null) return t('notLogged');

    if (cell.hasCheatMeal) return t('cheatDay');
    const { labelKey } = getHeatmapColor(cell.ratio);
    return `${t(labelKey)} · ${Math.round(cell.ratio * 100)}%`;
  };

  if (numWeeks === 0) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-full flex-col justify-center">
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: `${DAY_LABEL_COL}px repeat(${numWeeks}, minmax(0, 1fr))`,
            gap: `${gap}px`,
            maxWidth: `${DAY_LABEL_COL + numWeeks * MAX_SQ[range] + numWeeks * gap}px`,
          }}
        >
          {/* Row 1 — month headers, de-overlapped onto the columns they span. */}
          <HeatmapMonthHeaderRow headers={data.monthHeaders} />

          {/* Gutter — day labels, one per cell row. */}
          {DAY_LABELS.map((d, i) => (
            <div
              key={`lbl-${i}`}
              className="flex h-full items-center justify-end pr-1.5 font-medium text-nham-text-muted text-xs"
              style={{ gridRow: i + 2, gridColumn: 1 }}
            >
              {d}
            </div>
          ))}

          {/* Cells — square via aspect-ratio; their width (1fr) sizes the rows. */}
          {Array.from({ length: numWeeks }, (_, wi) =>
            data.cells.map((dayRow, di) => {
              const cell = dayRow[wi];
              const ratio = cell?.ratio ?? null;
              const { bg } = getHeatmapColor(ratio);
              const isLogged = cell?.status === 'logged' && ratio !== null;
              const isCheat = isLogged && Boolean(cell?.hasCheatMeal);
              const isPartial = cell?.status === 'partial';
              const isMuted =
                cell?.status === 'future' || cell?.status === 'outside';
              const isFocusable = (isLogged || isPartial) && !isMuted;
              const tooltipText = cell ? getTooltipText(cell) : t('notLogged');

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
                        'relative aspect-square w-full cursor-default rounded-[3px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/60',
                        // Cheat day: a calm warm ring instead of intensity
                        // grading — recognizable, never red.
                        isCheat && 'ring-1 ring-nham-cheat ring-inset'
                      )}
                      style={{
                        gridRow: di + 2,
                        gridColumn: wi + 2,
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
                            // Empty cells take their tint from the muted-ink
                            // taupe so the grid reads on the white card;
                            // future/outside days recede to a fainter step.
                            isMuted
                              ? 'bg-nham-text-muted/6'
                              : 'bg-nham-text-muted/12',
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

          {/* Legend — the grid's final row, spanning exactly the week columns
              so its edges align with the cells above. */}
          <div
            className="flex items-center gap-2 pt-2"
            style={{ gridRow: 9, gridColumn: `2 / span ${numWeeks}` }}
          >
            <span className="text-nham-text-muted text-xs">
              {t('offTarget')}
            </span>
            <div
              className="h-1.5 flex-1 rounded-full"
              style={{ background: heatmapLegendGradient() }}
            />
            <span className="text-nham-text-muted text-xs">
              {t('onTarget')}
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

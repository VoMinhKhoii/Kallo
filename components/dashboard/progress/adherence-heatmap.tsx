'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { AwaitingDayDialog } from '@/components/dashboard/heatmap-day/awaiting-day-dialog';
import {
  HeatmapDayTooltip,
  useHeatmapDayLabel,
} from '@/components/dashboard/heatmap-day/heatmap-day-label';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  HeatmapCell,
  HeatmapData,
  HeatmapRange,
} from '@/lib/core/types/dashboard';
import { cn } from '@/lib/core/ui/cn';
import {
  HEATMAP_CELL_PAINTS,
  HEATMAP_CELL_RADIUS_CLASS,
  heatmapTierFor,
  heatmapTierPaint,
} from './heatmap-colors';
import { HeatmapLegend } from './heatmap-legend';
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
  userId: string;
  /** Today's local day key — today can be reviewed but not yet confirmed. */
  todayDate: string;
}

/**
 * One CSS grid carries everything — the day-label gutter, the month headers,
 * the cells, and the legend — with `1fr` week columns, so the grid always
 * spans the card's width (sidebar collapsed or not) and the `aspect-square`
 * cells keep themselves square, sizing the rows. No measurement code.
 */
export function AdherenceHeatmap({
  data,
  range,
  userId,
  todayDate,
}: AdherenceHeatmapProps) {
  const t = useTranslations('dashboard.adherenceHeatmap');
  const labelOf = useHeatmapDayLabel();
  // The open awaiting day. Kept after close so the dialog's exit animation
  // still has its content.
  const [awaitingCell, setAwaitingCell] = useState<HeatmapCell | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // The cell the dialog opened from: the cells are not its trigger, so this
  // is where focus goes back to on close.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  // The 'year' range stagger fires up to 371 cells. Honour the OS-level
  // reduced-motion preference so users with vestibular-motion sensitivity
  // don't get a wall of moving cells. They still see the final state.
  const prefersReducedMotion = useReducedMotion();

  const gap = GAP[range];
  const numWeeks = data.cells[0]?.length ?? 0;

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
              className="flex h-full items-center justify-end pr-1.5 font-medium text-kallo-text-muted text-xs"
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
              const isLogged = cell?.status === 'logged' && ratio !== null;
              const isCheat = isLogged && Boolean(cell?.hasCheatMeal);
              const isPartial = cell?.status === 'partial';
              // Classify only; the APPEARANCE of each kind lives in
              // heatmap-colors.ts, where the legend reads the same records.
              const paint = isCheat
                ? HEATMAP_CELL_PAINTS.cheat
                : isLogged
                  ? heatmapTierPaint(heatmapTierFor(ratio))
                  : isPartial
                    ? HEATMAP_CELL_PAINTS.awaiting
                    : HEATMAP_CELL_PAINTS.empty;
              const isMuted =
                cell?.status === 'future' || cell?.status === 'outside';
              const isFocusable = (isLogged || isPartial) && !isMuted;
              const label = cell ? labelOf(cell) : null;
              const opensDialog = isPartial && !isMuted;

              return (
                <Tooltip key={`${di}-${wi}`}>
                  <TooltipTrigger asChild>
                    <motion.button
                      type="button"
                      aria-label={
                        label
                          ? `${label.heading}, ${label.status}`
                          : t('notLogged')
                      }
                      aria-disabled={!isFocusable}
                      tabIndex={isFocusable ? 0 : -1}
                      onClick={
                        opensDialog && cell
                          ? (event) => {
                              openerRef.current = event.currentTarget;
                              setAwaitingCell(cell);
                              setIsDialogOpen(true);
                            }
                          : undefined
                      }
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
                        'relative aspect-square w-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/60',
                        opensDialog ? 'cursor-pointer' : 'cursor-default',
                        HEATMAP_CELL_RADIUS_CLASS,
                        // The ring rides on the paint record, so the one
                        // actionable cell cannot grow or lose it on only one
                        // of the two surfaces that draw it.
                        paint.ringClass
                      )}
                      style={{
                        gridRow: di + 2,
                        gridColumn: wi + 2,
                        backgroundColor: paint.backgroundColor,
                        backgroundImage: paint.backgroundImage,
                      }}
                    ></motion.button>
                  </TooltipTrigger>
                  {label ? <HeatmapDayTooltip label={label} /> : null}
                </Tooltip>
              );
            })
          )}

          <HeatmapLegend numWeeks={numWeeks} />
        </div>
      </div>
      {awaitingCell ? (
        <AwaitingDayDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          returnFocusRef={openerRef}
          userId={userId}
          date={awaitingCell.date}
          calories={awaitingCell.calories ?? 0}
          isToday={awaitingCell.date === todayDate}
        />
      ) : null}
    </TooltipProvider>
  );
}

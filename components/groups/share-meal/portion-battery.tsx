'use client';

import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/core/ui/cn';
import { MIN_PARTS, TOTAL_PARTS } from '@/lib/domain/social/splits/parts';

/** One seat at the table: who, and how many parts they hold. */
export interface PortionSeat {
  id: string;
  initials: string;
  label: string;
  parts: number;
}

/**
 * Seat colours, in the order people join. Seat 0 is always you.
 *
 * A deliberate, scoped exception to the warm palette: the meter needs six hues
 * that stay apart at 18px wide, which sage and terracotta cannot do. Kept in
 * lockstep with `kSeatColors` in `portion_battery.dart` — the same share has to
 * look like the same share on both platforms.
 */
export const SEAT_COLORS = [
  '#141413',
  '#12B76A',
  '#FFB020',
  '#FF8A6B',
  '#F04438',
  '#2E90FA',
] as const;

/** Move one part across the boundary after `boundary`, clamped both ways. */
export function partsAfterDrag(
  parts: number[],
  boundary: number,
  desiredLeftEnd: number
): number[] {
  const before = parts.slice(0, boundary).reduce((a, b) => a + b, 0);
  const pairTotal = parts[boundary] + parts[boundary + 1];
  const leftEnd = Math.min(
    Math.max(desiredLeftEnd, before + MIN_PARTS),
    before + pairTotal - MIN_PARTS
  );
  const next = [...parts];
  next[boundary] = leftEnd - before;
  next[boundary + 1] = pairTotal - next[boundary];
  return next;
}

interface PortionBatteryProps {
  seats: PortionSeat[];
  totalKcal: number | null;
  onChange?: (parts: number[]) => void;
  onRemove?: (seat: number) => void;
  /** False for the recipient's copy: the notches disappear rather than dim. */
  interactive?: boolean;
}

/**
 * The portion battery: a dish divided into parts, one coloured run per person,
 * a draggable notch on every internal boundary and a water-drop pin above each
 * run carrying that person's kcal.
 *
 * Web has no haptics and no drag inertia, so the affordances it does have have
 * to work harder: `col-resize` on hover, the grip widening under the pointer,
 * and — the one that actually matters — every notch being a real
 * `role="slider"` with arrow-key stepping.
 */
export function PortionBattery({
  seats,
  totalKcal,
  onChange,
  onRemove,
  interactive = true,
}: PortionBatteryProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const trackId = useId();
  const parts = seats.map((s) => s.parts);
  const dishParts = parts.reduce((a, b) => a + b, 0);

  const commit = (next: number[]) => {
    if (next.every((p, i) => p === parts[i])) return;
    onChange?.(next);
  };

  const step = (boundary: number, by: number) => {
    const leftEnd = parts.slice(0, boundary + 1).reduce((a, b) => a + b, 0);
    commit(partsAfterDrag(parts, boundary, leftEnd + by));
  };

  const onPointerMove = (boundary: number, clientX: number) => {
    const track = document.getElementById(trackId);
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const perPart = rect.width / dishParts;
    if (perPart <= 0) return;
    commit(
      partsAfterDrag(
        parts,
        boundary,
        Math.round((clientX - rect.left) / perPart)
      )
    );
  };

  return (
    <div className="select-none">
      {/* Pins: kcal over an inverted water drop, centred on the run it owns. */}
      <div className="flex items-end">
        {seats.map((seat, i) => (
          <Pin
            key={seat.id}
            flex={seat.parts}
            initials={seat.initials}
            label={seat.label}
            color={SEAT_COLORS[i % SEAT_COLORS.length]}
            kcal={
              totalKcal == null
                ? null
                : Math.round((totalKcal * seat.parts) / dishParts)
            }
            onRemove={i === 0 || !onRemove ? undefined : () => onRemove(i)}
          />
        ))}
      </div>

      <div className="flex items-center">
        <div className="relative flex-1">
          <div className="flex h-[56px] rounded-[14px] border-2 border-kallo-text bg-white p-1">
            <div className="flex flex-1 gap-[2px]" id={trackId}>
              {seats.flatMap((seat, i) =>
                Array.from({ length: seat.parts }, (_, cell) => (
                  <div
                    className="flex-1 rounded-[6px]"
                    // Keyed by PERSON, not position, so a run growing or
                    // shrinking moves cells rather than recolouring them.
                    key={`cell-${seat.id}-${cell}`}
                    style={{
                      backgroundColor: SEAT_COLORS[i % SEAT_COLORS.length],
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {interactive &&
            seats.slice(0, -1).map((seat, boundary) => {
              const leftParts = parts
                .slice(0, boundary + 1)
                .reduce((a, b) => a + b, 0);
              const held = dragging === boundary;
              const right = seats[boundary + 1];
              return (
                <div
                  aria-label={`${seat.label} và ${right.label}`}
                  aria-valuemax={dishParts - MIN_PARTS}
                  aria-valuemin={MIN_PARTS}
                  aria-valuenow={parts[boundary]}
                  aria-valuetext={`${seat.label} ${parts[boundary]} phần, ${right.label} ${parts[boundary + 1]} phần`}
                  className={cn(
                    'absolute top-0 flex h-[56px] w-11 cursor-col-resize items-center justify-center',
                    '-translate-x-1/2 focus-visible:outline-none'
                  )}
                  key={`notch-${seat.id}`}
                  onKeyDown={(e) => {
                    // Arrows move one part, shift jumps five, Home/End clamp.
                    const by =
                      e.key === 'ArrowRight'
                        ? 1
                        : e.key === 'ArrowLeft'
                          ? -1
                          : 0;
                    if (by !== 0) {
                      e.preventDefault();
                      step(boundary, e.shiftKey ? by * 5 : by);
                    } else if (e.key === 'Home' || e.key === 'End') {
                      e.preventDefault();
                      step(
                        boundary,
                        e.key === 'Home' ? -TOTAL_PARTS : TOTAL_PARTS
                      );
                    }
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDragging(boundary);
                  }}
                  onPointerMove={(e) => {
                    if (dragging === boundary) {
                      onPointerMove(boundary, e.clientX);
                    }
                  }}
                  onPointerUp={() => setDragging(null)}
                  role="slider"
                  style={{ left: `${(leftParts / dishParts) * 100}%` }}
                  tabIndex={0}
                >
                  <span
                    className={cn(
                      'block rounded-full border-[1.5px] border-kallo-text bg-white transition-all',
                      // The grip is the only thing spanning the full shell, and
                      // it grows past it under a pointer — a 12px bar among
                      // 12px cell gaps is invisible otherwise.
                      held
                        ? 'h-[68px] w-[14px] shadow-lg'
                        : 'h-[48px] w-[12px] shadow-sm'
                    )}
                  />
                </div>
              );
            })}
        </div>
        {/* The nub. Decorative, and the reason this reads as a battery rather
            than a progress bar — so it is present in every state. */}
        <span className="ml-[3px] h-5 w-[5px] rounded-r-[3px] bg-kallo-text" />
      </div>
    </div>
  );
}

function Pin({
  flex,
  initials,
  label,
  color,
  kcal,
  onRemove,
}: {
  flex: number;
  initials: string;
  label: string;
  color: string;
  kcal: number | null;
  onRemove?: () => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-col items-center justify-end gap-1.5 pb-3"
      style={{ flex }}
    >
      {kcal !== null && (
        <span className="whitespace-nowrap font-sans-display text-[11px] text-kallo-text">
          {kcal}
        </span>
      )}
      <span className="relative block h-[30px] w-[30px]">
        <span
          aria-hidden="true"
          className="flex h-[30px] w-[30px] rotate-[-45deg] items-center justify-center rounded-[50%_50%_50%_0] border-2 border-white shadow-md"
          style={{ backgroundColor: color }}
        >
          <span className="rotate-45 font-sans-display text-[11px] text-white">
            {initials}
          </span>
        </span>
        {onRemove && (
          <button
            aria-label={`Bỏ ${label}`}
            className="absolute -top-1.5 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-kallo-border bg-white"
            onClick={onRemove}
            type="button"
          >
            <X className="h-2.5 w-2.5 text-kallo-text-muted" />
          </button>
        )}
      </span>
    </div>
  );
}

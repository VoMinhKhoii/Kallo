'use client';

import { useId, useState } from 'react';
import { PortionNotch } from '@/components/groups/share-meal/portion/notch';
import { PortionPin } from '@/components/groups/share-meal/portion/pin';
import { partsAfterDrag } from '@/lib/domain/social/splits/parts';

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
          <PortionPin
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
            seats.slice(0, -1).map((seat, boundary) => (
              <PortionNotch
                boundary={boundary}
                dishParts={dishParts}
                held={dragging === boundary}
                key={`notch-${seat.id}`}
                left={seat}
                leftParts={parts
                  .slice(0, boundary + 1)
                  .reduce((a, b) => a + b, 0)}
                onPointerDown={() => setDragging(boundary)}
                onPointerMove={(clientX) => {
                  if (dragging === boundary) {
                    onPointerMove(boundary, clientX);
                  }
                }}
                onPointerUp={() => setDragging(null)}
                onStep={(by) => step(boundary, by)}
                parts={parts}
                right={seats[boundary + 1]}
              />
            ))}
        </div>
        {/* The nub. Decorative, and the reason this reads as a battery rather
            than a progress bar — so it is present in every state. */}
        <span className="ml-[3px] h-5 w-[5px] rounded-r-[3px] bg-kallo-text" />
      </div>
    </div>
  );
}

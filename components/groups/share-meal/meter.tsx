'use client';

import {
  PortionBattery,
  type PortionSeat,
} from '@/components/groups/share-meal/portion/battery';
import { TOTAL_PARTS } from '@/lib/domain/social/splits/parts';

/**
 * The portion block: the meter, and the reset beside it.
 *
 * Twin of `ShareMealMeter` in `share_meal_meter.dart`. Presentation only —
 * every decision stays in the dialog.
 */
export function ShareMealMeter({
  seats,
  totalKcal,
  split,
  showEvenly,
  emptyLabel,
  evenlyLabel,
  onChange,
  onRemove,
  onSplitEvenly,
}: {
  seats: PortionSeat[];
  totalKcal: number | null;
  split: boolean;
  showEvenly: boolean;
  emptyLabel: string;
  evenlyLabel: string;
  onChange: (parts: number[]) => void;
  onRemove: (seat: number) => void;
  onSplitEvenly: () => void;
}) {
  // Seat 0 is always me, so one seat means nobody has been added yet.
  const alone = seats.length <= 1;

  return (
    <>
      <div className="mt-4">
        {alone ? (
          <p className="font-sans-display text-[13px] text-kallo-text-muted">
            {emptyLabel}
          </p>
        ) : split ? (
          <PortionBattery
            onChange={onChange}
            onRemove={onRemove}
            seats={seats}
            totalKcal={totalKcal}
          />
        ) : (
          // Nothing is divided, so nothing is drawn divided: one FULL battery
          // per person, each cell the width it has on the split meter. Twin of
          // `WholePortionBatteries` on mobile.
          <div className="flex items-end gap-3">
            {seats.map((seat, i) => (
              <div className="min-w-0 flex-1" key={seat.id}>
                <PortionBattery
                  interactive={false}
                  onRemove={() => onRemove(i)}
                  seats={[
                    {
                      ...seat,
                      parts: Math.floor(TOTAL_PARTS / seats.length),
                      colorIndex: i,
                    },
                  ]}
                  totalKcal={totalKcal}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {showEvenly && (
        <div className="flex justify-end">
          <button
            className="font-sans-display text-[12px] text-kallo-text"
            onClick={onSplitEvenly}
            type="button"
          >
            {evenlyLabel}
          </button>
        </div>
      )}
    </>
  );
}

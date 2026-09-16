'use client';

import {
  PortionBattery,
  type PortionSeat,
} from '@/components/groups/share-meal/portion-battery';

/**
 * The portion block: the meter, and the reset beside it.
 *
 * Twin of `ShareMealMeter` in `share_meal_meter.dart`. Presentation only —
 * every decision stays in the dialog.
 */
export function ShareMealMeter({
  seats,
  totalKcal,
  interactive,
  showEvenly,
  emptyLabel,
  evenlyLabel,
  onChange,
  onRemove,
  onSplitEvenly,
}: {
  seats: PortionSeat[];
  totalKcal: number | null;
  interactive: boolean;
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
        ) : (
          <PortionBattery
            interactive={interactive}
            onChange={onChange}
            onRemove={onRemove}
            seats={seats}
            totalKcal={totalKcal}
          />
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

'use client';

import { X } from 'lucide-react';

/**
 * kcal over an inverted water-drop pin, centred on the run it owns.
 *
 * Identity and quantity are the same object here: the pin sits above the cells
 * that belong to that person, so nobody has to match a name in a legend to a
 * colour in a bar.
 */
export function PortionPin({
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

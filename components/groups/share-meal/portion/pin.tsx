'use client';

import { X } from 'lucide-react';
import { ProfileAvatar } from '@/components/shared/profile-avatar';

/**
 * kcal over an inverted water-drop pin, centred on the run it owns.
 *
 * Identity and quantity are the same object here: the pin sits above the cells
 * that belong to that person, so nobody has to match a name in a legend to a
 * colour in a bar.
 *
 * The drop carries the person's real photo at 32px — the same size their avatar
 * has in the add-friends list below it, so the two read as the same person
 * rather than as a glyph and a face. Without a photo it keeps the seat colour
 * and their initials, which is what ties a pin to its coloured run.
 */
export function PortionPin({
  flex,
  avatarUrl,
  initials,
  label,
  color,
  kcal,
  onRemove,
}: {
  flex: number;
  avatarUrl: string | null;
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
        <span className="whitespace-nowrap font-sans-display text-[13px] text-kallo-text">
          {kcal}
        </span>
      )}
      <span className="relative block size-9">
        {/* 36px = the 32px avatar plus the 2px white ring on each side, and a
            seat-coloured ring outside that. A photo covers the drop's fill, so
            without the outer ring the only thing tying this pin to its run in
            the battery would be the tail. It is drawn on every pin, photo or
            not, so a table where only some people have a picture still reads
            as one family of markers — the twin of the nested ring box in
            `portion_pin.dart`. An outline, not a box-shadow: it follows the
            drop's radius, costs no layout, and leaves `shadow-md` alone. */}
        <span
          aria-hidden="true"
          className="flex size-9 rotate-[-45deg] items-center justify-center rounded-[50%_50%_50%_0] border-2 border-white shadow-md"
          style={{ backgroundColor: color, outline: `2px solid ${color}` }}
        >
          <ProfileAvatar
            avatarUrl={avatarUrl}
            // Transparent, not the disc's warm default: the drop is already
            // the seat colour, behind both the initials and a photo that has
            // not painted yet.
            className="size-8 rotate-45 bg-transparent"
            fallback={
              <span className="font-sans-display text-[12px] text-white">
                {initials}
              </span>
            }
            label={label}
          />
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

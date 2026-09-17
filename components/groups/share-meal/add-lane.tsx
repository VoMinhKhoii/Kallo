'use client';

import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import type { CircleMember } from '@/lib/actions/groups/types';

/**
 * Friends who are NOT yet at the table.
 *
 * Add-only: anyone already sharing the meal is a pin above the meter and
 * disappears from here, so nobody is ever listed twice and there is no
 * checkmark column to scan.
 *
 * The row is `ProfileAvatar` + `labelFor`, the same pair every other circle
 * list uses. The version this replaced drew its own initials disc, which meant
 * it never showed a friend their actual photo.
 *
 * The lane hangs 8px outside the dialog's gutter and the row pads back in by
 * the same 8px: the avatar stays on the gutter while the hover wash has room
 * to breathe. Flush against the avatar, its rounded corner clipped the disc.
 */
export function ShareMealAddLane({
  unseated,
  atCapacity,
  emptyLabel,
  onAdd,
}: {
  unseated: CircleMember[];
  atCapacity: boolean;
  emptyLabel: string;
  onAdd: (member: CircleMember) => void;
}) {
  if (unseated.length === 0) {
    return (
      <p className="py-3 font-sans-display text-[13px] text-kallo-text-muted">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="-mx-2 max-h-[150px] overflow-y-auto">
      {unseated.map((member) => (
        <button
          className="flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-kallo-hover/40 disabled:opacity-45"
          disabled={atCapacity}
          key={member.profile.userId}
          onClick={() => onAdd(member)}
          type="button"
        >
          <ProfileAvatar
            avatarUrl={member.profile.avatarUrl}
            className="size-8"
            label={labelFor(member.profile)}
          />
          <span className="truncate font-sans-display text-[14px] text-kallo-text">
            {labelFor(member.profile)}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Both the meter and the lane are unknown until the circle loads. */
export function ShareMealDialogSkeleton() {
  return (
    <div className="mt-4">
      <Skeleton className="mx-auto h-5 w-24" />
      <Skeleton className="mt-2.5 h-[46px] rounded-xl" />
      <div className="mt-5 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  );
}

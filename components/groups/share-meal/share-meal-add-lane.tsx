'use client';

import type { CircleMember } from '@/lib/actions/groups/types';

function initialsOf(label: string) {
  const words = label.trim().split(/\s+/u);
  if (words.length >= 2) {
    return (words.at(-2)?.[0] ?? '') + (words.at(-1)?.[0] ?? '');
  }
  return label.slice(0, 2).toUpperCase();
}

/**
 * Friends who are NOT yet at the table.
 *
 * Add-only: anyone already sharing the meal is a pin above the meter and
 * disappears from here, so nobody is ever listed twice and there is no
 * checkmark column to scan.
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
  return (
    <div className="max-h-[150px] overflow-y-auto">
      {unseated.length === 0 ? (
        <p className="py-3 font-sans-display text-[13px] text-kallo-text-muted">
          {emptyLabel}
        </p>
      ) : (
        unseated.map((member) => (
          <button
            className="flex w-full items-center gap-3 rounded-xl py-2 transition-colors hover:bg-kallo-hover/40 disabled:opacity-45"
            disabled={atCapacity}
            key={member.profile.userId}
            onClick={() => onAdd(member)}
            type="button"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-kallo-hover font-sans-display text-[12px] text-kallo-text">
              {initialsOf(
                member.profile.displayName ?? member.profile.handle
              ).toUpperCase()}
            </span>
            <span className="truncate font-sans-display text-[14px] text-kallo-text">
              {member.profile.displayName ?? member.profile.handle}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

/** Both the meter and the lane are unknown until the circle loads. */
export function ShareMealDialogSkeleton() {
  return (
    <div className="mt-4 animate-pulse">
      <div className="mx-auto h-5 w-24 rounded-lg bg-kallo-hover" />
      <div className="mt-2.5 h-[46px] rounded-xl bg-kallo-hover" />
      <div className="mt-5 space-y-3">
        <div className="h-8 w-40 rounded-lg bg-kallo-hover" />
        <div className="h-8 w-32 rounded-lg bg-kallo-hover" />
      </div>
    </div>
  );
}

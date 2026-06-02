'use client';

import type { PublicProfile } from '@/lib/groups/client';

type Identity = Pick<PublicProfile, 'displayName' | 'handle'>;

/** How a person is labelled in a circle: their display name, else their slug. */
export function labelFor(profile: Identity): string {
  return profile.displayName?.trim() || profile.handle;
}

function initialFor(profile: Identity): string {
  return labelFor(profile).charAt(0).toUpperCase();
}

/** Initials avatar + label, used in the circle list and the connect screen. */
export function ProfileIdentity({ profile }: { profile: Identity }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/50 ring-1 ring-nham-accent/25">
        <span
          className="font-bold text-[13px] text-nham-btn"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {initialFor(profile)}
        </span>
      </span>
      <span
        className="truncate text-[14px] text-nham-text"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {labelFor(profile)}
      </span>
    </div>
  );
}

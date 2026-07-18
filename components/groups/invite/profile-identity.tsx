'use client';

import { ProfileAvatar } from '@/components/groups/profile-avatar';
import type { PublicProfile } from '@/lib/groups/client';

type Identity = Pick<PublicProfile, 'displayName' | 'handle'>;

/** How a person is labelled in a circle: their display name, else their slug. */
export function labelFor(profile: Identity): string {
  return profile.displayName?.trim() || profile.handle;
}

/** Avatar + label, used in the circle list and the connect screen. */
export function ProfileIdentity({ profile }: { profile: PublicProfile }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProfileAvatar profile={profile} size="9" />
      <span className="truncate font-sans-display text-[14px] text-nham-text">
        {labelFor(profile)}
      </span>
    </div>
  );
}

'use client';

import { ProfileAvatar } from '@/components/shared/profile-avatar';
import type { PublicProfile } from '@/lib/groups/client';

type Identity = Pick<PublicProfile, 'displayName' | 'handle'> & {
  avatarUrl?: string | null;
};

/** How a person is labelled in a circle: their display name, else their slug. */
export function labelFor(profile: Identity): string {
  return profile.displayName?.trim() || profile.handle;
}

/** Avatar + label, used in the circle list, pickers, and the connect screen. */
export function ProfileIdentity({ profile }: { profile: Identity }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProfileAvatar
        avatarUrl={profile.avatarUrl ?? null}
        label={labelFor(profile)}
      />
      <span className="truncate font-sans-display text-[#141413] text-[14px]">
        {labelFor(profile)}
      </span>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { tintFor } from '@/components/groups/avatar-tint';
import { cn } from '@/lib/utils';

/** The identity fields every avatar render site already has. */
export interface AvatarIdentity {
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  avatarUrl: string | null;
}

const SIZES = {
  '6': { disc: 'size-6', text: 'text-[10px]' },
  '8': { disc: 'size-8', text: 'text-[12px]' },
  '9': { disc: 'size-9', text: 'text-[13px]' },
  '10': { disc: 'size-10', text: 'text-[14px]' },
  '16': { disc: 'size-16', text: 'text-[22px]' },
} as const;

/**
 * A person's avatar disc: their uploaded photo when set, else the warm
 * initials disc tinted from their avatar seed. A photo that fails to load
 * falls back to the initials, so a stale URL never renders a broken image.
 */
export function ProfileAvatar({
  profile,
  size = '9',
  className,
}: {
  profile: AvatarIdentity;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const { disc, text } = SIZES[size];
  const label = profile.displayName?.trim() || profile.handle;

  if (profile.avatarUrl && !broken) {
    return (
      <span
        className={cn(
          'shrink-0 overflow-hidden rounded-full ring-1 ring-nham-accent/25',
          disc,
          className
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: small remote storage object with a runtime error fallback; next/image adds no value here. */}
        <img
          src={profile.avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-1 ring-nham-accent/25',
        tintFor(profile.avatarSeed, profile.handle),
        disc,
        className
      )}
    >
      <span className={cn('font-bold font-sans-display text-nham-btn', text)}>
        {label.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}

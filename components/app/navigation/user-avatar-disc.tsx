'use client';

import { useState } from 'react';

/**
 * The signed-in user's 36px nav disc: their avatar photo when set, else their
 * initial on the warm gradient. `children` overlays the disc (onboarding dot).
 * A photo that fails to load falls back to the initial.
 */
export function UserAvatarDisc({
  initial,
  avatarUrl,
  children,
}: {
  initial: string;
  avatarUrl?: string | null;
  children?: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(avatarUrl) && !broken;

  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-visible rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/55 ring-1 ring-nham-accent/25">
      {showPhoto && avatarUrl ? (
        // biome-ignore lint/performance/noImgElement: small remote storage object with a runtime error fallback; next/image adds no value here.
        <img
          src={avatarUrl}
          alt=""
          className="size-full rounded-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="font-bold font-sans-display text-[13px] text-nham-btn">
          {initial}
        </span>
      )}
      {children}
    </span>
  );
}

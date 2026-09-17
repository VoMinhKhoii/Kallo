'use client';

import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/core/ui/cn';

/**
 * A circular profile avatar: the person's Google/Gmail picture when we have one
 * (captured into public_profiles at sign-in), falling back to the first letter
 * of their label on a warm disc. `referrerPolicy="no-referrer"` is required —
 * googleusercontent rejects hotlinked requests that carry a referer.
 *
 * `fallback` replaces that disc where the caller has a better glyph than a
 * first letter — the portion meter's pin draws two initials on the seat colour,
 * and for seat 0 a localised "You" that no avatar component could derive.
 * Owning both branches here keeps "photo, else glyph" one decision.
 *
 * The glyph is always rendered and the photo is laid OVER it, so the gap before
 * a photo decodes shows the glyph rather than an empty disc. A photo that never
 * arrives — a stale googleusercontent URL, or a viewer briefly offline — is
 * REMOVED on error rather than merely uncovered: an `<img>` that failed still
 * paints a broken-image icon over whatever is behind it, `alt=""`
 * notwithstanding (verified in Chromium). Tracking the URL that failed, rather
 * than a bare boolean, means a later upload is retried instead of being
 * suppressed by the previous one's failure.
 */
export function ProfileAvatar({
  avatarUrl,
  label,
  className,
  fallback,
}: {
  avatarUrl: string | null;
  label: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = avatarUrl !== null && avatarUrl !== failedUrl;

  return (
    <span
      className={cn(
        'relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E8E6DC]',
        className
      )}
    >
      {fallback ?? (
        <span
          aria-hidden="true"
          className="font-bold font-sans-display text-[#141413] text-[12px]"
        >
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      {showPhoto && (
        // biome-ignore lint/performance/noImgElement: remote Google avatars aren't worth a next/image remotePatterns entry
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}

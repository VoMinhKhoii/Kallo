'use client';

import { useTranslations } from 'next-intl';

/** Number of placeholder rows shown while the circle feed loads. */
const SKELETON_COUNT = 3;

/**
 * Loading state for a Circle thread (FriendsFeed / GroupFeed). Mirrors the
 * flat, borderless Threads-style feed — hairline-divided placeholder rows
 * (avatar disc plus two text bars) — so the layout doesn't shift when real
 * posts arrive, and no empty state flashes during the fetch.
 */
export function CircleWallSkeleton() {
  const t = useTranslations('groups.wall');
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
      className="flex min-h-0 flex-1 flex-col"
    >
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          key={index}
          className="flex gap-3 border-[#E8E6DC] border-b p-4 last:border-b-0"
        >
          <div className="size-8 shrink-0 rounded-full bg-kallo-track motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-1/3 rounded bg-kallo-track motion-safe:animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-kallo-track motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Fragment, type ReactNode, useEffect, useRef } from 'react';
import { CircleError } from '@/components/groups/circle-error';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import {
  threadDayKey,
  threadDayLabel,
} from '@/components/groups/timeline/thread-day';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';

export interface ThreadFeedItem {
  id: string;
  timestamp: string;
  content: ReactNode;
}

interface ThreadFeedProps {
  /** Newest-first — the render order (feed convention: newest at the top). */
  entries: ThreadFeedItem[];
  composer?: ReactNode;
  /** Shown centered when the feed is empty. `emptyMessage` is the supporting
   *  line; pass `emptyTitle`/`emptyPose`/`emptyAction` for the fuller state. */
  emptyMessage: string;
  emptyTitle?: string;
  /** Which capybara stands in for the emptiness — the telescope by default,
   *  the box for a scope that already has its own first pose on screen. */
  emptyPose?: 'empty' | 'emptyAlt';
  emptyAction?: ReactNode;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

/** Shared infinite-scroll feed body for FriendsFeed/GroupFeed. Renders as flat
 * Threads-style posts inside one bordered panel: each entry is a FeedEntry row,
 * hairline-separated, left-aligned, with hairline day separators. Newest sits
 * at the top (feed convention); a sentinel below the oldest entry loads older
 * shares as it scrolls into view — older content appends at the bottom, so no
 * scroll-anchoring is needed. */
export function ThreadFeed({
  entries,
  composer,
  emptyMessage,
  emptyTitle,
  emptyPose = 'empty',
  emptyAction,
  isPending,
  isError,
  isFetching,
  refetch,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: ThreadFeedProps) {
  const t = useTranslations('groups.wall');
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Newest-first opens at the top already, and older entries append at the
  // bottom — so there is nothing to auto-scroll or scroll-anchor. A sentinel
  // below the last row loads the next (older) page as it nears the viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([sentinelEntry]) => {
        if (
          sentinelEntry?.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          fetchNextPage();
        }
      },
      { root: container, rootMargin: '0px 0px 200px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isPending) {
    return <CircleWallSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  let lastDayKey: string | null = null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {composer}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {entries.length > 0 ? (
          <>
            {entries.map((entry) => {
              const dayKey = threadDayKey(entry.timestamp);
              const showSeparator = dayKey !== lastDayKey;
              lastDayKey = dayKey;
              return (
                <Fragment key={entry.id}>
                  {showSeparator && (
                    <div className="flex items-center gap-2.5 px-4 pt-5 pb-3 font-sans-display text-[#6E6D66] text-[11px]">
                      <span className="h-px flex-1 bg-[#E8E6DC]" />
                      {threadDayLabel(
                        entry.timestamp,
                        locale,
                        t('todayLabel'),
                        t('yesterdayLabel')
                      )}
                      <span className="h-px flex-1 bg-[#E8E6DC]" />
                    </div>
                  )}
                  <div className="border-[#E8E6DC] border-b p-4 last:border-b-0">
                    {entry.content}
                  </div>
                </Fragment>
              );
            })}
            {isFetchingNextPage && (
              <p className="py-2 text-center font-sans-display text-[#6E6D66] text-[11px]">
                {t('loadingMore')}
              </p>
            )}
            <div ref={sentinelRef} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <SurfaceState
              action={emptyAction}
              area="circle"
              kind={emptyPose}
              subtitle={emptyTitle ? emptyMessage : undefined}
              title={emptyTitle ?? emptyMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

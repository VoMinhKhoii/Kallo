'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { CircleError } from '@/components/groups/circle-error';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { FeedEntry } from '@/components/groups/feed-entry';
import type { CircleFeedEntry } from '@/lib/groups/client';

/** Local calendar-day identity for an ISO timestamp — used only for
 * same-day grouping, not display, so timezone-dependent formatting is fine. */
function localDateKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dayLabel(
  iso: string,
  locale: string,
  todayLabel: string,
  yesterdayLabel: string
): string {
  const now = new Date();
  const key = localDateKey(iso);
  if (key === localDateKey(now.toISOString())) return todayLabel;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === localDateKey(yesterday.toISOString())) return yesterdayLabel;

  const date = new Date(iso);
  return date.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

interface ThreadFeedProps {
  /** Oldest-first — the render order (chat convention: newest at the bottom). */
  entries: CircleFeedEntry[];
  emptyMessage: string;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

/** Shared infinite-scroll thread body for FriendsFeed/GroupFeed. Renders the
 * feed as flat Threads-style posts inside one bordered panel: each entry is a
 * FeedEntry row, hairline-separated, all left-aligned, with hairline day
 * separators. Newest entry sits at the bottom; a sentinel above the oldest
 * entry loads older shares as it scrolls into view, and scroll position is
 * preserved when older entries are prepended (without this the viewport
 * visually jumps by the height of whatever was just inserted above it). */
export function ThreadFeed({
  entries,
  emptyMessage,
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
  const prevScrollHeightRef = useRef<number | null>(null);
  const scrolledToBottomRef = useRef(false);

  // Land on the most recent entry once, the first time the page has content.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || isPending || scrolledToBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
    scrolledToBottomRef.current = true;
  }, [isPending]);

  // After older entries are prepended, restore the pre-prepend visual
  // position by the height delta they just added above the viewport.
  // biome-ignore lint/correctness/useExhaustiveDependencies: entries.length is the deliberate re-run trigger
  useLayoutEffect(() => {
    const container = containerRef.current;
    const prevHeight = prevScrollHeightRef.current;
    if (!container || prevHeight == null) return;
    container.scrollTop += container.scrollHeight - prevHeight;
    prevScrollHeightRef.current = null;
  }, [entries.length]);

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
          // Capture height BEFORE the fetch resolves and prepends rows.
          prevScrollHeightRef.current = container.scrollHeight;
          fetchNextPage();
        }
      },
      { root: container, rootMargin: '200px 0px 0px 0px' }
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-nham-border/60 bg-white">
      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
        {entries.length > 0 ? (
          <>
            <div ref={sentinelRef} />
            {isFetchingNextPage && (
              <p className="py-2 text-center font-sans-display text-[11px] text-nham-text-muted">
                {t('loadingMore')}
              </p>
            )}
            {entries.map((entry) => {
              const dayKey = localDateKey(entry.meal.sharedAt);
              const showSeparator = dayKey !== lastDayKey;
              lastDayKey = dayKey;
              return (
                <Fragment key={entry.meal.shareId}>
                  {showSeparator && (
                    <div className="flex items-center gap-2.5 px-4 pt-5 pb-3 font-sans-display text-[11px] text-nham-text-muted">
                      <span className="h-px flex-1 bg-nham-border/60" />
                      {dayLabel(
                        entry.meal.sharedAt,
                        locale,
                        t('todayLabel'),
                        t('yesterdayLabel')
                      )}
                      <span className="h-px flex-1 bg-nham-border/60" />
                    </div>
                  )}
                  <div className="border-nham-border/60 border-b p-4 last:border-b-0">
                    <FeedEntry entry={entry} />
                  </div>
                </Fragment>
              );
            })}
          </>
        ) : (
          <p className="p-4 font-sans-display text-[13px] text-nham-text-muted">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}

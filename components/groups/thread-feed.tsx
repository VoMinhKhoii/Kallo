'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { CircleCard } from '@/components/groups/circle-card';
import { CircleError } from '@/components/groups/circle-error';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import type { CircleFeedEntry } from '@/lib/groups/client';
import { cn } from '@/lib/utils';

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
  title: string;
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

/** Shared infinite-scroll thread body for FriendsFeed/GroupFeed. Renders
 * newest entry at the bottom, loads older shares as a sentinel above the
 * oldest entry scrolls into view, and preserves scroll position when older
 * entries are prepended (without this the viewport visually jumps by the
 * height of whatever was just inserted above it). */
export function ThreadFeed({
  title,
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Outside the scroll area (not just `sticky`) so the thread's name is
       * always visible — the view lands on the newest entry at the bottom by
       * default, which would otherwise scroll the title off-screen above. */}
      <header className="shrink-0 border-nham-border/60 border-b px-5 py-4 sm:px-8">
        <h1 className="font-normal font-serif text-nham-text text-xl tracking-tight">
          {title}
        </h1>
      </header>
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8"
      >
        {entries.length > 0 ? (
          <div className="flex flex-col gap-4">
            <div ref={sentinelRef} />
            {isFetchingNextPage && (
              <p className="text-center font-sans-display text-[11px] text-nham-text-muted">
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
                    <div className="flex items-center justify-center">
                      <span className="rounded-full bg-nham-hover/60 px-3 py-1 font-sans-display text-[11px] text-nham-text-muted">
                        {dayLabel(
                          entry.meal.sharedAt,
                          locale,
                          t('todayLabel'),
                          t('yesterdayLabel')
                        )}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex',
                      entry.isSelf ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <CircleCard
                      entry={entry}
                      align={entry.isSelf ? 'right' : 'left'}
                    />
                  </div>
                </Fragment>
              );
            })}
          </div>
        ) : (
          <p className="font-sans-display text-[13px] text-nham-text-muted">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
}

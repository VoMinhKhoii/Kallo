'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useNotificationFeed } from '@/hooks/notifications/use-notification-feed';
import { useMarkNotificationsSeen } from '@/hooks/notifications/use-notification-state';
import type {
  NotificationFeedPage,
  NotificationItem,
} from '@/lib/domain/notifications/contracts';
import { ActivitySections } from './activity-sections';
import { ActivityError, ActivitySkeleton } from './activity-states';

/** The newest `createdAt` we actually showed — the mark-seen watermark, never
 *  `now()`, so a notification that lands mid-render still badges. */
function newestCreatedAt(items: NotificationItem[]): string | null {
  let newest: string | null = null;
  for (const item of items) {
    if (!newest || item.createdAt > newest) newest = item.createdAt;
  }
  return newest;
}

/** Is there anything to clear, according to the feed response we are actually
 *  rendering? The badge query is a separate 30s poll, so gating on it would
 *  skip mark-seen for a notification that arrived between two polls — rendered
 *  here, never marked. The feed GET already answers this twice over: it
 *  returns the server's `unseenCount` alongside the page, and each item
 *  carries its own `seenAt`. */
function hasUnseenInPages(pages: NotificationFeedPage[] | undefined): boolean {
  if (!pages) return false;
  return pages.some(
    (page) =>
      page.unseenCount > 0 || page.items.some((item) => item.seenAt === null)
  );
}

/**
 * The Activity surface: one centered Threads-style column of notifications,
 * bucketed New / Last 30 days / Older. No tabs in v1 — the volume is tiny and
 * the single actionable type (a copy/split offer) sits inline like Instagram's
 * follow-request row.
 *
 * Opening the page clears the badge once: after the first page resolves, the
 * newest `createdAt` in it is posted as the seen watermark. Whether there is
 * anything to clear is judged from THAT response — never from the badge poll,
 * whose cached count can still read zero for a row this page is already
 * showing. The ref guard matters because marking seen invalidates this very
 * query — without it the refetch would post again on every round trip.
 */
export function ActivityPage() {
  const t = useTranslations('activity');
  const feed = useNotificationFeed();
  const markSeen = useMarkNotificationsSeen();
  const markedSeenRef = useRef(false);

  const pages = feed.data?.pages;
  const items = useMemo(
    () => pages?.flatMap((page) => page.items) ?? [],
    [pages]
  );
  const hasUnseen = useMemo(() => hasUnseenInPages(pages), [pages]);

  const { isSuccess } = feed;
  const { mutate: postMarkSeen } = markSeen;
  useEffect(() => {
    if (markedSeenRef.current || !isSuccess || !hasUnseen) return;
    const watermark = newestCreatedAt(items);
    if (!watermark) return;
    markedSeenRef.current = true;
    postMarkSeen(watermark);
  }, [isSuccess, hasUnseen, items, postMarkSeen]);

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col px-4 pt-4 pb-4 sm:px-5">
      <header className="mb-1 shrink-0">
        <h1 className="font-bold font-sans-display text-[18px] text-kallo-text tracking-[-0.01em]">
          {t('title')}
        </h1>
      </header>

      {feed.isPending && <ActivitySkeleton label={t('loading')} />}

      {feed.isError && (
        <ActivityError
          onRetry={() => void feed.refetch()}
          isRetrying={feed.isFetching}
        />
      )}

      {!(feed.isPending || feed.isError) &&
        (items.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={t('empty.title')}
            description={t('empty.description')}
          />
        ) : (
          <ActivitySections
            items={items}
            hasNextPage={feed.hasNextPage}
            isFetchingNextPage={feed.isFetchingNextPage}
            fetchNextPage={() => void feed.fetchNextPage()}
          />
        ))}
    </main>
  );
}

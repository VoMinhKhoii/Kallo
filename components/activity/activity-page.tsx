'use client';

import { AlertCircle, Heart, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useUnseenNotificationCount } from '@/hooks/notifications/use-notification-badge';
import { useNotificationFeed } from '@/hooks/notifications/use-notification-feed';
import { useMarkNotificationsSeen } from '@/hooks/notifications/use-notification-state';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import { ActivitySections } from './activity-sections';

const SKELETON_COUNT = 4;

function ActivitySkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          key={index}
          className="flex gap-3 border-kallo-border border-b px-4 py-3.5 last:border-b-0"
        >
          <div className="size-9 shrink-0 rounded-full bg-kallo-track motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-2/3 rounded bg-kallo-track motion-safe:animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-kallo-track motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityError({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const t = useTranslations('activity');
  return (
    <div
      role="alert"
      className="mt-2 rounded-2xl border border-kallo-danger/30 bg-kallo-danger/[0.06] p-4"
    >
      <div className="flex gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-kallo-danger"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="font-sans-display font-semibold text-[13px] text-kallo-text">
            {t('error.title')}
          </p>
          <p className="mt-1 font-sans-display text-[13px] text-kallo-text-muted">
            {t('error.body')}
          </p>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            aria-busy={isRetrying}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-kallo-danger/10 px-3.5 py-2 font-medium font-sans-display text-[13px] text-kallo-danger transition-colors hover:bg-kallo-danger/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {t('error.retry')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The newest `createdAt` we actually showed — the mark-seen watermark, never
 *  `now()`, so a notification that lands mid-render still badges. */
function newestCreatedAt(items: NotificationItem[]): string | null {
  let newest: string | null = null;
  for (const item of items) {
    if (!newest || item.createdAt > newest) newest = item.createdAt;
  }
  return newest;
}

/**
 * The Activity surface: one centered Threads-style column of notifications,
 * bucketed New / Last 30 days / Older. No tabs in v1 — the volume is tiny and
 * the single actionable type (a copy/split offer) sits inline like Instagram's
 * follow-request row.
 *
 * Opening the page clears the badge once: after the first page resolves, the
 * newest `createdAt` in it is posted as the seen watermark. The ref guard
 * matters because marking seen invalidates this very query — without it the
 * refetch would post again on every round trip.
 */
export function ActivityPage() {
  const t = useTranslations('activity');
  const feed = useNotificationFeed();
  const unseenCount = useUnseenNotificationCount();
  const markSeen = useMarkNotificationsSeen();
  const markedSeenRef = useRef(false);

  const items = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data]
  );

  const { isSuccess } = feed;
  const { mutate: postMarkSeen } = markSeen;
  useEffect(() => {
    if (markedSeenRef.current || !isSuccess || unseenCount <= 0) return;
    const watermark = newestCreatedAt(items);
    if (!watermark) return;
    markedSeenRef.current = true;
    postMarkSeen(watermark);
  }, [isSuccess, unseenCount, items, postMarkSeen]);

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

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import { NotificationRow } from './notification-row';
import { ShareInviteRow } from './share-invite-row';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface ActivityBuckets {
  /** Unseen in the payload as fetched — Instagram's "New". */
  fresh: NotificationItem[];
  recent: NotificationItem[];
  older: NotificationItem[];
}

/**
 * Presentation-only split into New / Last 30 days / Older.
 *
 * "New" is driven by `newIds`, a snapshot of what was unseen when each row
 * first arrived — NOT by the live `seenAt`. Opening the page bulk-clears seen
 * server-side and `useMarkNotificationsSeen` invalidates the feed query, so a
 * live re-derivation would empty the section under the reader's cursor a few
 * hundred milliseconds after it painted. The snapshot is per visit: a remount
 * (or a page navigation back here) is the point at which "new" is recomputed.
 */
export function bucketNotifications(
  items: NotificationItem[],
  newIds: ReadonlySet<string>,
  now: number = Date.now()
): ActivityBuckets {
  const buckets: ActivityBuckets = { fresh: [], recent: [], older: [] };
  const cutoff = now - THIRTY_DAYS_MS;
  for (const item of items) {
    if (newIds.has(item.id)) {
      buckets.fresh.push(item);
    } else if (new Date(item.createdAt).getTime() >= cutoff) {
      buckets.recent.push(item);
    } else {
      buckets.older.push(item);
    }
  }
  return buckets;
}

/** Accumulates the ids that were unseen the first time we rendered them. Held
 *  in a ref rather than state: it is derived from the data already in hand, so
 *  writing it during render keeps buckets and rows on the same snapshot with
 *  no extra pass. */
function useNewIdSnapshot(items: NotificationItem[]): ReadonlySet<string> {
  const snapshot = useRef<Set<string>>(new Set());
  for (const item of items) {
    if (!item.seenAt) snapshot.current.add(item.id);
  }
  return snapshot.current;
}

function SectionHeading({ label }: { label: string }) {
  return (
    <h2 className="px-4 pt-5 pb-2 font-medium font-sans-display text-[12px] text-kallo-text-muted">
      {label}
    </h2>
  );
}

function ActivityRow({
  item,
  isNew,
}: {
  item: NotificationItem;
  isNew: boolean;
}) {
  if (item.type === 'share.invite') {
    return <ShareInviteRow item={item} isNew={isNew} />;
  }
  return <NotificationRow item={item} isNew={isNew} />;
}

/**
 * The feed body: bucketed sections plus the infinite-scroll sentinel. Newest
 * sits at the top, older pages append below, so nothing needs scroll
 * anchoring — the sentinel below the last row pulls the next page in as it
 * nears the viewport.
 */
export function ActivitySections({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  items: NotificationItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const t = useTranslations('activity');
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const newIds = useNewIdSnapshot(items);
  const buckets = bucketNotifications(items, newIds);

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

  const sections: { key: string; label: string; rows: NotificationItem[] }[] = [
    { key: 'new', label: t('sections.new'), rows: buckets.fresh },
    { key: 'recent', label: t('sections.recent'), rows: buckets.recent },
    { key: 'older', label: t('sections.older'), rows: buckets.older },
  ];

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {sections.map((section) =>
        section.rows.length > 0 ? (
          <section key={section.key}>
            <SectionHeading label={section.label} />
            {section.rows.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                isNew={newIds.has(item.id)}
              />
            ))}
          </section>
        ) : null
      )}
      {isFetchingNextPage && (
        <p className="py-2 text-center font-sans-display text-[11px] text-kallo-text-muted">
          {t('loadingMore')}
        </p>
      )}
      <div ref={sentinelRef} />
    </div>
  );
}

'use client';

import { CircleCard } from '@/components/groups/circle-card';
import { CircleEmpty } from '@/components/groups/circle-empty';
import { CircleError } from '@/components/groups/circle-error';
import { CirclePresenceStrip } from '@/components/groups/circle-presence-strip';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';

/**
 * The ambient Circle wall: most-recent-per-friend, today only, capped and
 * NON-scrollable (the feed is already bounded server-side). Read-only and
 * badge-free by design — never a global newsfeed.
 */
export function CircleWall() {
  const {
    data: feed = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useCircleFeed();

  if (isPending) {
    return <CircleWallSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const sharedTodayUserIds = new Set(feed.map((entry) => entry.friend.userId));

  return (
    <div>
      <CirclePresenceStrip sharedTodayUserIds={sharedTodayUserIds} />
      {feed.length === 0 ? (
        <CircleEmpty />
      ) : (
        <div className="space-y-6 pl-4 sm:pl-10">
          {feed.map((entry) => (
            <CircleCard key={entry.friend.userId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

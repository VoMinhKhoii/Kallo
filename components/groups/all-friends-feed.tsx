'use client';

import { CircleEmpty } from '@/components/groups/circle-empty';
import { CircleError } from '@/components/groups/circle-error';
import { CircleCard } from '@/components/groups/circle-wall';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';
import { cn } from '@/lib/utils';

/** Default right-pane view (no friend selected): every friend's most-recent
 * shared meal today, combined — same ambient feed the original Circle wall
 * used, PLUS the actor's own entry, laid out like an ordinary chat thread
 * (own meal on the right, everyone else's on the left, oldest to newest). */
export function AllFriendsFeed() {
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

  if (feed.length === 0) {
    return <CircleEmpty />;
  }

  const chronological = [...feed].sort(
    (a, b) =>
      new Date(a.meal.sharedAt).getTime() - new Date(b.meal.sharedAt).getTime()
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
      <div className="flex flex-col gap-4">
        {chronological.map((entry) => (
          <div
            key={entry.friend.userId}
            className={cn('flex', entry.isSelf ? 'justify-end' : 'justify-start')}
          >
            <CircleCard entry={entry} align={entry.isSelf ? 'right' : 'left'} />
          </div>
        ))}
      </div>
    </div>
  );
}

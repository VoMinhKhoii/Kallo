import { Suspense } from 'react';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { CircleFeedPanel } from '@/components/groups/navigation/circle-feed-panel';

/** Keep a real route leaf for initial loading, focus and scroll handling. */
export default function GroupFeedPage() {
  return (
    <Suspense fallback={<CircleWallSkeleton />}>
      <CircleFeedPanel />
    </Suspense>
  );
}

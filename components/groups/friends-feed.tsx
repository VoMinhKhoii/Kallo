'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import { FeedEntry } from '@/components/groups/feed-entry';
import { ThreadFeed } from '@/components/groups/thread-feed';
import { Button } from '@/components/ui/button';
import { useFriendsThreadFeed } from '@/hooks/social/circle/use-friend-thread-feed';

/** Right-pane detail for the combined Friends feed: every accepted friend's
 * shared meal plus the actor's own, merged into one feed, infinite-scrolled —
 * newest at the top, scrolling down loads earlier days. Replaces the old
 * per-friend 1:1 thread pages. */
export function FriendsFeed() {
  const t = useTranslations('groups.page');
  const {
    data,
    isPending,
    isError,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useFriendsThreadFeed();

  // Pages arrive newest-page-first, each page newest-entry-first — flattening
  // in that order already yields one continuous newest→oldest sequence, which
  // is exactly the newest-first order ThreadFeed renders (newest at the top).
  const entries = (data?.pages ?? []).flatMap((page) => page.entries);
  const items = entries.map((entry) => ({
    id: entry.meal.shareId,
    timestamp: entry.meal.sharedAt,
    content: <FeedEntry entry={entry} />,
  }));

  return (
    <ThreadFeed
      entries={items}
      emptyTitle={t('friendsEmptyTitle')}
      emptyMessage={t('friendsNoMealToday')}
      emptyAction={
        <AddFriendDialog
          trigger={
            <Button size="sm">
              <UserPlus className="h-3.5 w-3.5" />
              {t('addFriend')}
            </Button>
          }
        />
      }
      isPending={isPending}
      isError={isError}
      isFetching={isFetching}
      refetch={() => void refetch()}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={() => void fetchNextPage()}
    />
  );
}

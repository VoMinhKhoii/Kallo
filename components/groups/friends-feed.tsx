'use client';

import { UserPlus, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import { FeedEntry } from '@/components/groups/feed-entry';
import { ThreadFeed } from '@/components/groups/thread-feed';
import { useFriendsThreadFeed } from '@/hooks/social/use-friend-thread-feed';

/** Right-pane detail for the combined Friends thread: every accepted
 * friend's shared meal, merged into one feed (excluding the actor's own),
 * infinite-scrolled — newest at the bottom by default, scrolling up loads
 * earlier days. Replaces the old per-friend 1:1 thread pages. */
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
  // in that order already yields one continuous newest→oldest sequence, so a
  // single reverse() gives the oldest-first order ThreadFeed renders in.
  const entries = (data?.pages ?? []).flatMap((page) => page.entries).reverse();
  const items = entries.map((entry) => ({
    id: entry.meal.shareId,
    timestamp: entry.meal.sharedAt,
    content: <FeedEntry entry={entry} />,
  }));

  return (
    <ThreadFeed
      entries={items}
      emptyIcon={Users2}
      emptyTitle={t('friendsEmptyTitle')}
      emptyMessage={t('friendsNoMealToday')}
      emptyAction={
        <AddFriendDialog
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-nham-btn px-3.5 py-2 font-medium font-sans-display text-[13px] text-white transition-colors hover:bg-nham-btn/90"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t('addFriend')}
            </button>
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

'use client';

import { useTranslations } from 'next-intl';
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

  return (
    <ThreadFeed
      title={t('friendsSectionTitle')}
      entries={entries}
      emptyMessage={t('friendsNoMealToday')}
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

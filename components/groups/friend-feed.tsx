'use client';

import { useTranslations } from 'next-intl';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ThreadFeed } from '@/components/groups/thread-feed';
import { useFriendThreadFeed } from '@/hooks/social/use-friend-thread-feed';
import { useFriends } from '@/hooks/social/use-friends';

/** Right-pane detail: this friend's shared-meal history with the actor,
 * infinite-scrolled — newest at the bottom by default, scrolling up loads
 * earlier days. Laid out like an ordinary 1:1 chat thread (their meal on the
 * left, the actor's own on the right). */
export function FriendFeed({ friendUserId }: { friendUserId: string }) {
  const t = useTranslations('groups.page');
  const { data: members = [] } = useFriends();
  const {
    data,
    isPending,
    isError,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useFriendThreadFeed(friendUserId);

  const friendMember = members.find((m) => m.profile.userId === friendUserId);
  const friendName = friendMember ? labelFor(friendMember.profile) : '';

  // Pages arrive newest-page-first, each page newest-entry-first — flattening
  // in that order already yields one continuous newest→oldest sequence, so a
  // single reverse() gives the oldest-first order ThreadFeed renders in.
  const entries = (data?.pages ?? []).flatMap((page) => page.entries).reverse();

  return (
    <ThreadFeed
      title={friendName}
      entries={entries}
      emptyMessage={t('friendNoMealToday', { name: friendName })}
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

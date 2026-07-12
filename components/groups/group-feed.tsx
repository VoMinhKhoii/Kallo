'use client';

import { useTranslations } from 'next-intl';
import { ThreadFeed } from '@/components/groups/thread-feed';
import { useChatGroup, useGroupMealFeed } from '@/hooks/social/use-chat-groups';

/** Right-pane detail for a group: every member's shared-meal history,
 * infinite-scrolled — newest at the bottom by default, scrolling up loads
 * earlier days. Same layout as FriendFeed, just scoped to a chat group's
 * membership instead of a single friend. */
export function GroupFeed({ groupId }: { groupId: string }) {
  const t = useTranslations('groups.page');
  const { data: group } = useChatGroup(groupId);
  const {
    data,
    isPending,
    isError,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useGroupMealFeed(groupId);

  const groupName = group?.name ?? '';

  // Pages arrive newest-page-first, each page newest-entry-first — flattening
  // in that order already yields one continuous newest→oldest sequence, so a
  // single reverse() gives the oldest-first order ThreadFeed renders in.
  const entries = (data?.pages ?? []).flatMap((page) => page.entries).reverse();

  return (
    <ThreadFeed
      title={groupName}
      entries={entries}
      emptyMessage={t('groupNoMealToday', { name: groupName })}
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

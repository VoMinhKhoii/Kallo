'use client';

import { useTranslations } from 'next-intl';
import { FeedEntry } from '@/components/groups/feed-entry';
import { GroupInfo } from '@/components/groups/info/group-info';
import { ThreadFeed } from '@/components/groups/thread-feed';
import {
  useChatGroup,
  useGroupMealFeed,
} from '@/hooks/social/circle/use-chat-groups';

/** A group's meal feed with per-meal replies (stage 1 — no universal chat).
 * Logging happens through the AI meal bar in the Circle layout above. */
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
  // yields newest-first, exactly the order ThreadFeed renders.
  const items = (data?.pages ?? [])
    .flatMap((page) => page.entries)
    .map((entry) => ({
      id: entry.meal.shareId,
      timestamp: entry.meal.sharedAt,
      content: <FeedEntry entry={entry} />,
    }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GroupInfo group={group} />
      <ThreadFeed
        entries={items}
        emptyPose="emptyAlt"
        emptyMessage={t('groupNoActivity', { name: groupName })}
        isPending={isPending}
        isError={isError}
        isFetching={isFetching}
        refetch={() => void refetch()}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={() => void fetchNextPage()}
      />
    </div>
  );
}

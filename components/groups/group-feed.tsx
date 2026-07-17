'use client';

import { MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FeedEntry } from '@/components/groups/feed-entry';
import { ThreadFeed } from '@/components/groups/thread-feed';
import { GroupComposer } from '@/components/groups/timeline/group-composer';
import { GroupMembersRow } from '@/components/groups/timeline/group-members-row';
import { MessageEntry } from '@/components/groups/timeline/message-entry';
import { useMyProfile } from '@/hooks/profile/use-profile';
import { useChatGroup } from '@/hooks/social/use-chat-groups';
import { useGroupTimeline } from '@/hooks/social/use-group-timeline';

/** Right-pane detail for a group's merged meal-and-message timeline. */
export function GroupFeed({ groupId }: { groupId: string }) {
  const t = useTranslations('groups.page');
  const { data: group } = useChatGroup(groupId);
  const { data: profile } = useMyProfile();
  const {
    data,
    isPending,
    isError,
    isFetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useGroupTimeline(groupId);

  const groupName = group?.name ?? '';

  // Pages arrive newest-page-first, each page newest-entry-first — flattening
  // in that order already yields one continuous newest→oldest sequence, so a
  // single reverse() gives the oldest-first order ThreadFeed renders in.
  const entries = (data?.pages ?? []).flatMap((page) => page.entries).reverse();
  const items = entries.map((entry) =>
    entry.type === 'meal'
      ? {
          id: entry.meal.shareId,
          timestamp: entry.meal.sharedAt,
          content: <FeedEntry entry={entry} />,
        }
      : {
          id: entry.id,
          timestamp: entry.sentAt,
          content: <MessageEntry entry={entry} />,
        }
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GroupMembersRow group={group} />
      <ThreadFeed
        entries={items}
        composer={
          <GroupComposer
            groupId={groupId}
            groupName={groupName}
            profile={profile}
          />
        }
        emptyIcon={MessagesSquare}
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

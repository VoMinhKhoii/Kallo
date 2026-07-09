'use client';

import { useTranslations } from 'next-intl';
import { CircleError } from '@/components/groups/circle-error';
import { CircleCard } from '@/components/groups/circle-wall';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import {
  useChatGroup,
  useGroupMealFeed,
} from '@/hooks/social/use-chat-groups';
import { cn } from '@/lib/utils';

/** Right-pane detail for a group: every member's most-recent shared meal
 * today, laid out like the friend thread (own meal on the right, everyone
 * else's on the left, oldest to newest) — same idea as FriendFeed, just
 * scoped to a chat group's membership instead of a single friend. */
export function GroupFeed({ groupId }: { groupId: string }) {
  const t = useTranslations('groups.page');
  const { data: group } = useChatGroup(groupId);
  const {
    data: feed = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useGroupMealFeed(groupId);

  const groupName = group?.name ?? '';

  if (isPending) {
    return <CircleWallSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const entries = [...feed].sort(
    (a, b) =>
      new Date(a.meal.sharedAt).getTime() -
      new Date(b.meal.sharedAt).getTime()
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
      <header className="mb-5">
        <h1 className="font-normal font-serif text-nham-text text-xl tracking-tight">
          {groupName}
        </h1>
      </header>
      {entries.length > 0 ? (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <div
              key={entry.friend.userId}
              className={cn(
                'flex',
                entry.isSelf ? 'justify-end' : 'justify-start'
              )}
            >
              <CircleCard
                entry={entry}
                align={entry.isSelf ? 'right' : 'left'}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="font-sans-display text-[13px] text-nham-text-muted">
          {t('groupNoMealToday', { name: groupName })}
        </p>
      )}
    </div>
  );
}

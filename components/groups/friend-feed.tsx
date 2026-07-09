'use client';

import { useTranslations } from 'next-intl';
import { CircleError } from '@/components/groups/circle-error';
import { CircleCard } from '@/components/groups/circle-wall';
import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';
import { useFriends } from '@/hooks/social/use-friends';
import { cn } from '@/lib/utils';

/** Right-pane detail: this friend's most-recent shared meal today, pulled
 * from the same ambient feed the original Circle wall used, PLUS the actor's
 * own entry — laid out like an ordinary 1:1 chat thread (their meal on the
 * left, the actor's own on the right, oldest to newest). */
export function FriendFeed({ friendUserId }: { friendUserId: string }) {
  const t = useTranslations('groups.page');
  const { data: members = [] } = useFriends();
  const {
    data: feed = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useCircleFeed();

  const friendMember = members.find((m) => m.profile.userId === friendUserId);
  const friendName = friendMember ? labelFor(friendMember.profile) : '';

  if (isPending) {
    return <CircleWallSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const entries = feed
    .filter((e) => e.friend.userId === friendUserId || e.isSelf)
    .sort(
      (a, b) =>
        new Date(a.meal.sharedAt).getTime() -
        new Date(b.meal.sharedAt).getTime()
    );

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
      <header className="mb-5">
        <h1 className="font-normal font-serif text-nham-text text-xl tracking-tight">
          {friendName}
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
          {t('friendNoMealToday', { name: friendName })}
        </p>
      )}
    </div>
  );
}

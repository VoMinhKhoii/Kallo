'use client';

import { MoreVertical } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { tintFor } from '@/components/groups/avatar-tint';
import { CircleEmpty } from '@/components/groups/circle-empty';
import { CircleError } from '@/components/groups/circle-error';
import { labelFor } from '@/components/groups/invite/profile-identity';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';
import {
  useBlockFriend,
  useFriends,
  useRemoveFriend,
} from '@/hooks/social/use-friends';
import { Link } from '@/i18n/navigation';
import { formatElapsed } from '@/lib/date/format-elapsed';
import type { CircleMember } from '@/lib/groups/client';

function FriendListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-[60px] animate-pulse rounded-xl bg-nham-hover/50"
        />
      ))}
    </div>
  );
}

/** Remove/Block, ported from the original CirclePresenceStrip popover — a
 * sibling to the row's Link (not nested inside it) so the menu button and
 * row navigation don't fight over the click. */
function FriendRowMenu({ member }: { member: CircleMember }) {
  const t = useTranslations('groups.wall');
  const removeFriend = useRemoveFriend();
  const blockFriend = useBlockFriend();
  const name = labelFor(member.profile);
  const busy = removeFriend.isPending || blockFriend.isPending;

  const handleRemove = () => {
    removeFriend.mutate(member.profile.userId, {
      onSuccess: () => toast.success(t('removed')),
      onError: () => toast.error(t('actionError')),
    });
  };
  const handleBlock = () => {
    blockFriend.mutate(member.profile.userId, {
      onSuccess: () => toast.success(t('blocked')),
      onError: () => toast.error(t('actionError')),
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('memberActions', { name })}
          className="flex shrink-0 items-center justify-center rounded-lg p-1.5 text-nham-text-muted transition-colors hover:bg-nham-hover/60 hover:text-nham-text"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-40 rounded-xl border-nham-border/60 p-1.5"
      >
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          className="flex w-full items-center rounded-lg px-2 py-1.5 text-left font-medium font-sans-display text-[13px] text-nham-text transition-colors hover:bg-nham-hover/50 disabled:opacity-50"
        >
          {t('remove')}
        </button>
        <button
          type="button"
          onClick={handleBlock}
          disabled={busy}
          className="flex w-full items-center rounded-lg px-2 py-1.5 text-left font-medium font-sans-display text-[13px] text-nham-danger transition-colors hover:bg-nham-danger/10 disabled:opacity-50"
        >
          {t('block')}
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** The left-pane's friends section: every accepted friend. Clicking one shows
 * their shared meals for today on the right — the original Circle feature,
 * reorganized as a master-detail list instead of one combined ambient wall. */
export function FriendList() {
  const t = useTranslations('groups.page');
  const locale = useLocale();
  const {
    data: members = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useFriends();
  const { data: feed = [] } = useCircleFeed();

  if (isPending) {
    return <FriendListSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const friends = members.filter((m) => m.status === 'accepted');

  if (friends.length === 0) {
    return <CircleEmpty />;
  }

  // Each friend's own most-recent shared meal today — same ambient feed
  // FriendFeed reads from, so no extra request beyond what's already cached.
  const lastMealSharedAtByFriendId = new Map(
    feed
      .filter((entry) => !entry.isSelf)
      .map((entry) => [entry.friend.userId, entry.meal.sharedAt])
  );

  return (
    <div className="space-y-2">
      <h2 className="px-1 font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.08em]">
        {t('friendsSectionTitle')}
      </h2>
      <ul className="space-y-2">
        {friends.map((member: CircleMember) => {
          const name = labelFor(member.profile);
          const tint = tintFor(
            member.profile.avatarSeed,
            member.profile.handle
          );
          const lastMealSharedAt = lastMealSharedAtByFriendId.get(
            member.profile.userId
          );
          return (
            <li
              key={member.friendshipId}
              className="flex items-center gap-1 rounded-xl border border-nham-border/60 bg-white pr-1.5 transition-colors hover:border-nham-accent/40"
            >
              <Link
                href={`/groups/${member.profile.userId}`}
                className="flex min-w-0 flex-1 items-center gap-3 p-3"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-1 ring-nham-accent/25 ${tint}`}
                >
                  <span className="font-bold font-sans-display text-[14px] text-nham-btn">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-sans-display text-[14px] text-nham-text">
                    {name}
                  </span>
                  {lastMealSharedAt && (
                    <span className="truncate font-sans-display text-[11px] text-nham-text-muted">
                      {t('newFoodLog')} ·{' '}
                      {formatElapsed(lastMealSharedAt, locale)}
                    </span>
                  )}
                </span>
              </Link>
              <FriendRowMenu member={member} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

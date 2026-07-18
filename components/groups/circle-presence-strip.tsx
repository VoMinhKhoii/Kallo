'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { labelFor } from '@/components/groups/invite/profile-identity';
import { ProfileAvatar } from '@/components/groups/profile-avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useBlockFriend,
  useFriends,
  useRemoveFriend,
} from '@/hooks/social/use-friends';
import type { CircleMember } from '@/lib/groups/client';
import { cn } from '@/lib/utils';

function MemberDisc({
  member,
  sharedToday,
}: {
  member: CircleMember;
  sharedToday: boolean;
}) {
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
          className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
        >
          <ProfileAvatar
            profile={member.profile}
            size="10"
            className={cn(
              'transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-nham-accent',
              // Shared-today reads as a soft filled ring; quiet stays a muted
              // outline disc — participation visible at a glance, no sentence.
              sharedToday
                ? 'ring-nham-accent/40'
                : 'opacity-60 ring-nham-border/50'
            )}
          />
          <span className="max-w-[4.5rem] truncate font-sans-display text-[10px] text-nham-text-muted">
            {name}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-44 rounded-xl border-nham-border/60 p-1.5"
      >
        <p className="px-2 py-1 font-sans-display text-[11px] text-nham-text-muted">
          {sharedToday ? t('sharedTodayHint') : t('quietHint')}
        </p>
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

/**
 * The presence strip: one warm initials-disc per circle member. Members who
 * shared something today are tinted; quiet members are a muted outline disc —
 * membership and today's participation become visible at a glance, no sentence.
 * Tapping a disc opens a member popover (Remove / Block).
 */
export function CirclePresenceStrip({
  sharedTodayUserIds,
}: {
  sharedTodayUserIds: Set<string>;
}) {
  const t = useTranslations('groups.wall');
  const { data: members = [], isPending } = useFriends();

  // While the roster loads, hold the strip's space with muted disc
  // placeholders so the wall doesn't jump when members pop in.
  if (isPending) {
    return (
      <section
        aria-label={t('presenceLabel')}
        aria-busy="true"
        className="mb-6 pl-4 sm:pl-10"
      >
        <div className="flex animate-pulse flex-wrap items-start gap-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col items-center gap-1.5">
              <span className="size-10 rounded-full bg-nham-border/40 ring-1 ring-nham-border/50" />
              <span className="h-2.5 w-10 rounded-full bg-nham-border/40" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const accepted = members.filter((m) => m.status === 'accepted');
  if (accepted.length === 0) return null;

  return (
    <section aria-label={t('presenceLabel')} className="mb-6 pl-4 sm:pl-10">
      <div className="flex flex-wrap items-start gap-4">
        {accepted.map((member) => (
          <MemberDisc
            key={member.friendshipId}
            member={member}
            sharedToday={sharedTodayUserIds.has(member.profile.userId)}
          />
        ))}
      </div>
    </section>
  );
}

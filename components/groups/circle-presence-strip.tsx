'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { labelFor } from '@/components/groups/invite/profile-identity';
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

// Warm, status-free disc tints. Sage is reserved for status, so members are
// tinted across tan / taupe / stone only (deterministic from avatarSeed).
const DISC_TINTS = [
  'from-nham-accent/35 to-nham-border/45', // tan
  'from-[#b8a890]/40 to-[#9c8c78]/35', // taupe
  'from-[#cfc6ba]/45 to-[#a9a193]/35', // stone
] as const;

function tintFor(seed: string | null, handle: string): string {
  const key = seed ?? handle;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return DISC_TINTS[Math.abs(hash) % DISC_TINTS.length];
}

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
  const initial = name.charAt(0).toUpperCase();
  const tint = tintFor(member.profile.avatarSeed, member.profile.handle);
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
          <span
            className={cn(
              'flex size-10 items-center justify-center rounded-full bg-gradient-to-br ring-1 transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-nham-accent',
              tint,
              // Shared-today reads as a soft filled ring; quiet stays a muted
              // outline disc — participation visible at a glance, no sentence.
              sharedToday
                ? 'ring-nham-accent/40'
                : 'opacity-60 ring-nham-border/50'
            )}
          >
            <span
              className="font-bold text-[14px] text-nham-btn"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {initial}
            </span>
          </span>
          <span
            className="max-w-[4.5rem] truncate text-[10px] text-nham-text-muted"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {name}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-44 rounded-xl border-nham-border/60 p-1.5"
      >
        <p
          className="px-2 py-1 text-[11px] text-nham-text-muted"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {sharedToday ? t('sharedTodayHint') : t('quietHint')}
        </p>
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          className="flex w-full items-center rounded-lg px-2 py-1.5 text-left font-medium text-[13px] text-nham-text transition-colors hover:bg-nham-hover/50 disabled:opacity-50"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          {t('remove')}
        </button>
        <button
          type="button"
          onClick={handleBlock}
          disabled={busy}
          className="flex w-full items-center rounded-lg px-2 py-1.5 text-left font-medium text-[13px] text-nham-danger transition-colors hover:bg-nham-danger/10 disabled:opacity-50"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
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

'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CircleError } from '@/components/groups/circle-error';
import {
  useBlockFriend,
  useFriends,
  useRemoveFriend,
} from '@/hooks/social/use-friends';
import type { CircleMember } from '@/lib/actions/groups/types';
import { ProfileIdentity } from './profile-identity';

/** The signed-in user's accepted connections, each with Remove/Block actions
 * — the only friend-management surface now that the sidebar's Friends
 * section is one combined thread instead of a per-friend row list. */
export function CircleList() {
  const t = useTranslations('groups.circle');
  const tWall = useTranslations('groups.wall');
  const { data: members = [], isError, isFetching, refetch } = useFriends();
  const removeFriend = useRemoveFriend();
  const blockFriend = useBlockFriend();

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const circle = members.filter((m) => m.status === 'accepted');

  if (circle.length === 0) {
    return (
      <p className="px-1 py-2 font-sans-display text-[#6E6D66] text-[12px]">
        {t('empty')}
      </p>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="px-1 font-medium font-sans-display text-[#6E6D66] text-[10px] uppercase tracking-[0.08em]">
        {t('title', { count: circle.length })}
      </h3>
      <ul className="space-y-2">
        {circle.map((member: CircleMember) => (
          <li
            key={member.friendshipId}
            className="flex items-center justify-between gap-3 rounded-xl border border-[#E8E6DC] bg-white p-3"
          >
            <ProfileIdentity profile={member.profile} />
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  blockFriend.mutate(member.profile.userId, {
                    onSuccess: () => toast.success(tWall('blocked')),
                    onError: () => toast.error(tWall('actionError')),
                  })
                }
                disabled={blockFriend.isPending}
                aria-busy={blockFriend.isPending}
                className="inline-flex items-center rounded-lg border border-[#E8E6DC] px-2.5 py-1.5 font-medium font-sans-display text-[#6E6D66] text-[12px] transition-colors hover:bg-kallo-danger/10 hover:text-kallo-danger disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tWall('block')}
              </button>
              <button
                type="button"
                onClick={() =>
                  removeFriend.mutate(member.profile.userId, {
                    onError: () => toast.error(t('removeError')),
                  })
                }
                disabled={removeFriend.isPending}
                aria-busy={removeFriend.isPending}
                className="inline-flex items-center rounded-lg border border-[#E8E6DC] px-2.5 py-1.5 font-medium font-sans-display text-[#6E6D66] text-[12px] transition-colors hover:bg-kallo-danger/10 hover:text-kallo-danger disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

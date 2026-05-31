'use client';

import { useTranslations } from 'next-intl';
import { useFriends, useRemoveFriend } from '@/hooks/use-friends';
import type { CircleMember } from '@/lib/groups/client';
import { ProfileIdentity } from './profile-identity';

/** The signed-in user's accepted connections, each with a Remove action. */
export function CircleList() {
  const t = useTranslations('groups.circle');
  const { data: members = [] } = useFriends();
  const removeFriend = useRemoveFriend();

  const circle = members.filter((m) => m.status === 'accepted');

  if (circle.length === 0) {
    return (
      <p
        className="px-1 py-2 text-[12px] text-nham-text-muted"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {t('empty')}
      </p>
    );
  }

  return (
    <section className="space-y-2">
      <h3
        className="px-1 font-medium text-[10px] text-nham-text-muted uppercase tracking-[0.08em]"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {t('title', { count: circle.length })}
      </h3>
      <ul className="space-y-2">
        {circle.map((member: CircleMember) => (
          <li
            key={member.friendshipId}
            className="flex items-center justify-between gap-3 rounded-xl border border-nham-border/60 bg-white p-3"
          >
            <ProfileIdentity profile={member.profile} />
            <button
              type="button"
              onClick={() => removeFriend.mutate(member.profile.userId)}
              disabled={removeFriend.isPending}
              className="inline-flex shrink-0 items-center rounded-lg border border-nham-border/60 px-2.5 py-1.5 font-medium text-[12px] text-nham-text-muted transition-colors hover:bg-nham-danger/10 hover:text-nham-danger disabled:cursor-not-allowed disabled:opacity-60"
              style={{ fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('remove')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { tintFor } from '@/components/groups/avatar-tint';
import { CircleError } from '@/components/groups/circle-error';
import { useMyChatGroups } from '@/hooks/social/use-chat-groups';
import { Link } from '@/i18n/navigation';

function GroupListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="h-[60px] animate-pulse rounded-xl bg-nham-hover/50"
        />
      ))}
    </div>
  );
}

/** The left-pane's group section: named group chats the actor belongs to.
 * Hidden entirely when there are none yet — create one via the Add-friend
 * modal's "Create group" tab. Clicking one shows its members' shared meals
 * for today on the right, the same way a friend does. */
export function GroupList() {
  const t = useTranslations('groups.page');
  const {
    data: groups = [],
    isPending,
    isError,
    isFetching,
    refetch,
  } = useMyChatGroups();

  if (isPending) {
    return <GroupListSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const namedGroups = groups.filter((g) => g.kind === 'group');

  if (namedGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="px-1 font-medium font-sans-display text-[10px] text-nham-text-muted uppercase tracking-[0.08em]">
        {t('groupsSectionTitle')}
      </h2>
      <ul className="space-y-2">
        {namedGroups.map((group) => {
          const tint = tintFor(group.avatarSeed, group.title);
          return (
            <li key={group.id}>
              <Link
                href={`/groups/g/${group.id}`}
                className="flex items-center gap-3 rounded-xl border border-nham-border/60 bg-white p-3 transition-colors hover:border-nham-accent/40"
              >
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-1 ring-nham-accent/25 ${tint}`}
                >
                  <span className="font-bold font-sans-display text-[14px] text-nham-btn">
                    {group.title.charAt(0).toUpperCase()}
                  </span>
                </span>
                <span className="truncate font-sans-display text-[14px] text-nham-text">
                  {group.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

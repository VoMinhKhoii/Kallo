'use client';

import { useTranslations } from 'next-intl';
import { AddFriendDialog } from '@/components/groups/add-friend-dialog';
import { useMyChatGroups } from '@/hooks/social/use-chat-groups';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';
import { useFriendsFeedReadMarker } from '@/hooks/social/use-friend-thread-feed';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const PILL_BASE =
  'inline-flex items-center gap-[7px] whitespace-nowrap rounded-full ' +
  'px-4 py-2 font-sans-display text-[12.5px] text-nham-text-muted ' +
  'transition-colors';
const PILL_ACTIVE = 'bg-nham-accent/15 font-medium text-nham-text';

function UnreadDot() {
  return (
    <span
      aria-hidden="true"
      className="size-[7px] shrink-0 rounded-full bg-nham-accent"
    />
  );
}

/** The Threads-style pill row atop /groups, replacing the old master-detail
 * sidebar. A standalone "All" pill links to the merged friends feed; a
 * bordered cluster holds one pill per named group plus a "+ New" pill that
 * opens the create-group tab of AddFriendDialog. Unread dots mirror the logic
 * in FriendsRow (All) and GroupList (each group). */
export function ViewSwitcher() {
  const t = useTranslations('groups.switcher');
  const pathname = usePathname();
  const { data: groups = [], isError, refetch } = useMyChatGroups();
  const { data: feed = [] } = useCircleFeed();
  const { data: readMarker } = useFriendsFeedReadMarker();

  const namedGroups = groups.filter((g) => g.kind === 'group');

  // Most recent shared meal across all friends (excluding the actor's own) —
  // the same ambient feed FriendsRow reads from, so no extra request.
  const latestSharedAt = feed
    .filter((entry) => !entry.isSelf)
    .reduce<string | null>(
      (latest, entry) =>
        !latest || new Date(entry.meal.sharedAt) > new Date(latest)
          ? entry.meal.sharedAt
          : latest,
      null
    );

  // Defaults to false while the marker is still loading, to avoid a flash.
  const allUnread = Boolean(
    latestSharedAt &&
      readMarker &&
      new Date(latestSharedAt) > new Date(readMarker.lastReadAt)
  );

  return (
    <nav
      aria-label={t('label')}
      className="my-0.5 mb-4 flex items-center gap-2.5 overflow-x-auto"
    >
      <Link
        href="/groups"
        aria-current={pathname === '/groups' ? 'page' : undefined}
        className={cn(
          'border border-nham-border/60 bg-white',
          PILL_BASE,
          pathname === '/groups' && `${PILL_ACTIVE} border-nham-accent/45`
        )}
      >
        {allUnread && <UnreadDot />}
        {t('all')}
      </Link>

      <div className="inline-flex gap-0.5 rounded-full border border-nham-border/60 bg-white p-1">
        {namedGroups.map((group) => {
          const href = `/groups/g/${group.id}`;
          const active = pathname === href;
          return (
            <Link
              key={group.id}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                PILL_BASE,
                'px-[13px] py-[5px]',
                active && PILL_ACTIVE
              )}
            >
              {group.unread && <UnreadDot />}
              {group.title}
            </Link>
          );
        })}

        {/* On a load failure the group pills would otherwise vanish silently,
         * stranding the only path to a group — offer an explicit retry. */}
        {isError && (
          <button
            type="button"
            onClick={() => void refetch()}
            className={cn(PILL_BASE, 'px-[13px] py-[5px]')}
          >
            {t('retry')}
          </button>
        )}

        <AddFriendDialog
          defaultTab="group"
          trigger={
            <button
              type="button"
              className={cn(PILL_BASE, 'px-[13px] py-[5px] text-nham-accent')}
            >
              {t('new')}
            </button>
          }
        />
      </div>
    </nav>
  );
}

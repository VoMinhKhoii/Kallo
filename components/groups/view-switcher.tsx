'use client';

import { useTranslations } from 'next-intl';
import { useMyChatGroups } from '@/hooks/social/use-chat-groups';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';
import { useFriendsFeedReadMarker } from '@/hooks/social/use-friend-thread-feed';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';

const PILL_BASE =
  'inline-flex items-center gap-[7px] whitespace-nowrap rounded-full ' +
  'px-4 py-2 font-sans-display text-[12.5px] transition-colors';
// Selected chip fills the whole pill with the sidebar's selected-item wash.
const PILL_ACTIVE = 'bg-kallo-hover font-semibold text-[#141413]';
const PILL_INACTIVE = 'border border-[#E8E6DC] bg-white text-[#6E6D66]';

function UnreadDot() {
  return (
    <span
      aria-hidden="true"
      className="size-[7px] shrink-0 rounded-full bg-[#141413]"
    />
  );
}

/** The Threads-style pill row atop /circle, replacing the old master-detail
 * sidebar. A standalone "All" pill links to the merged friends feed; a
 * bordered cluster holds one pill per named group. Creation lives in the
 * header CircleAddMenu, not here. Hidden entirely until you have at least one
 * group — with only "All" there is nothing to switch between. Unread dots
 * mirror the logic in FriendsRow (All) and GroupList (each group). */
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

  // Nothing to switch between until there's a group (keep it visible on error
  // so the retry affordance isn't stranded).
  if (namedGroups.length === 0 && !isError) return null;

  return (
    <nav
      aria-label={t('label')}
      className="mb-3 flex items-center gap-2 overflow-x-auto"
    >
      <Link
        href="/circle"
        aria-current={pathname === '/circle' ? 'page' : undefined}
        className={cn(
          PILL_BASE,
          pathname === '/circle' ? PILL_ACTIVE : PILL_INACTIVE
        )}
      >
        {allUnread && <UnreadDot />}
        {t('all')}
      </Link>

      {namedGroups.map((group) => {
        const href = `/circle/g/${group.id}`;
        const active = pathname === href;
        return (
          <Link
            key={group.id}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(PILL_BASE, active ? PILL_ACTIVE : PILL_INACTIVE)}
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
          className={cn(PILL_BASE, PILL_INACTIVE)}
        >
          {t('retry')}
        </button>
      )}
    </nav>
  );
}

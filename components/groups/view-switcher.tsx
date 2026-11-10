'use client';

import { useTranslations } from 'next-intl';
import { CircleFeedLink } from '@/components/groups/navigation/circle-feed-link';
import { useMyChatGroups } from '@/hooks/social/circle/use-chat-groups';
import { useFriendsFeedReadMarker } from '@/hooks/social/circle/use-friend-thread-feed';
import { usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/core/ui/cn';
import { circleGroupHref } from '@/lib/domain/social/circle-routes';

const PILL_BASE =
  'inline-flex items-center gap-[7px] whitespace-nowrap rounded-full ' +
  'px-4 py-2 font-sans-display text-[12.5px] transition-colors';
// Selected chip fills the whole pill with the sidebar's selected-item wash.
const PILL_ACTIVE = 'bg-kallo-hover font-semibold text-kallo-text';
const PILL_INACTIVE =
  'border border-kallo-border bg-card text-kallo-text-muted';

function UnreadDot() {
  return (
    <span
      aria-hidden="true"
      className="size-[7px] shrink-0 rounded-full bg-kallo-ink"
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
  const { data: readMarker } = useFriendsFeedReadMarker();

  const namedGroups = groups.filter((g) => g.kind === 'group');

  // This polled marker already covers every friend share, including meals
  // eaten on earlier days. Fetching the ambient wall here duplicated that
  // work and competed with the first feed load on the small DB pool.
  const latestSharedAt = readMarker?.latestSharedAt;

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
      <CircleFeedLink
        href="/circle"
        aria-current={pathname === '/circle' ? 'page' : undefined}
        className={cn(
          PILL_BASE,
          pathname === '/circle' ? PILL_ACTIVE : PILL_INACTIVE
        )}
      >
        {allUnread && <UnreadDot />}
        {t('all')}
      </CircleFeedLink>

      {namedGroups.map((group) => {
        const href = circleGroupHref(group.id);
        const active = pathname === href;
        return (
          <CircleFeedLink
            key={group.id}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(PILL_BASE, active ? PILL_ACTIVE : PILL_INACTIVE)}
          >
            {group.unread && <UnreadDot />}
            {group.title}
          </CircleFeedLink>
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

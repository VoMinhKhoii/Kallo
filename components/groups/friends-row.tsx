'use client';

import { Users2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CircleError } from '@/components/groups/circle-error';
import { useCircleFeed } from '@/hooks/social/use-circle-feed';
import { useFriends } from '@/hooks/social/use-friends';
import { Link } from '@/i18n/navigation';
import { formatElapsed } from '@/lib/date/format-elapsed';

function FriendsRowSkeleton() {
  return <div className="h-[60px] animate-pulse rounded-xl bg-nham-hover/50" />;
}

/** The left-pane's Friends section: one combined row for the actor's whole
 * friend graph (not one row per friend — see FriendsFeed). Hidden entirely
 * when the actor has no accepted friends yet, matching GroupList's
 * hide-when-empty convention. Clicking it opens the merged thread of every
 * friend's shared meal, excluding the actor's own. */
export function FriendsRow() {
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
    return <FriendsRowSkeleton />;
  }

  if (isError) {
    return (
      <CircleError onRetry={() => void refetch()} isRetrying={isFetching} />
    );
  }

  const hasFriends = members.some((m) => m.status === 'accepted');
  if (!hasFriends) {
    return null;
  }

  // Most recent shared meal across all friends today — same ambient feed
  // FriendsFeed's sidebar entry point reads from, so no extra request.
  const latestSharedAt = feed
    .filter((entry) => !entry.isSelf)
    .reduce<string | null>(
      (latest, entry) =>
        !latest || new Date(entry.meal.sharedAt) > new Date(latest)
          ? entry.meal.sharedAt
          : latest,
      null
    );

  return (
    <Link
      href="/groups/friends"
      className="flex items-center gap-3 rounded-xl border border-nham-border/60 bg-white p-3 transition-colors hover:border-nham-accent/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nham-accent/40 to-nham-border/55 ring-1 ring-nham-accent/25">
        <Users2 className="h-4 w-4 text-nham-btn" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-sans-display text-[14px] text-nham-text">
          {t('friendsSectionTitle')}
        </span>
        {latestSharedAt && (
          <span className="truncate font-sans-display text-[11px] text-nham-text-muted">
            {t('newFoodLog')} · {formatElapsed(latestSharedAt, locale)}
          </span>
        )}
      </span>
    </Link>
  );
}

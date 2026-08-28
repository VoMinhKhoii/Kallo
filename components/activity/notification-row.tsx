'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { useMarkNotificationRead } from '@/hooks/notifications/use-notification-state';
import { Link } from '@/i18n/navigation';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import { cn } from '@/lib/core/ui/cn';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import {
  actorLabel,
  messageKey,
  messageValues,
  notificationHref,
} from './notification-copy';

/** Up to two overlapping faces, most recent actor in front. More than two
 *  actors are carried by the "and N others" copy, not by more discs. */
export function NotificationAvatars({
  item,
  fallbackLabel,
}: {
  item: NotificationItem;
  fallbackLabel: string;
}) {
  const [first, second] = item.actors;
  return (
    <span className="relative size-9 shrink-0">
      {second && (
        <ProfileAvatar
          avatarUrl={second.avatarUrl}
          label={second.displayName?.trim() || second.handle || fallbackLabel}
          className="absolute top-0 right-0 size-7 ring-2 ring-kallo-surface"
        />
      )}
      <ProfileAvatar
        avatarUrl={first?.avatarUrl ?? null}
        label={first?.displayName?.trim() || first?.handle || fallbackLabel}
        className={cn(
          'absolute size-8',
          second ? 'bottom-0 left-0' : 'inset-0'
        )}
      />
    </span>
  );
}

/** The templated message line — bold actor name plus the per-type sentence. */
export function NotificationMessage({
  item,
  fallbackLabel,
}: {
  item: NotificationItem;
  fallbackLabel: string;
}) {
  const t = useTranslations('activity');
  const name = actorLabel(item, fallbackLabel);
  return (
    <>
      {t.rich(messageKey(item), {
        ...messageValues(item, name),
        b: (chunks: ReactNode) => (
          <b className="font-bold text-kallo-text">{chunks}</b>
        ),
      })}
    </>
  );
}

/**
 * One flat Threads-style activity row: avatar stack, the templated message,
 * and a muted elapsed time. The whole row is the link — tapping marks the
 * notification read fire-and-forget (optimistic in the hook) so navigation is
 * never blocked on the write.
 *
 * `isNew` is the caller's fetched-payload snapshot, not `seenAt` — opening the
 * page clears seen server-side, and the row must not lose its tint underneath
 * the reader mid-visit.
 */
export function NotificationRow({
  item,
  isNew,
}: {
  item: NotificationItem;
  isNew: boolean;
}) {
  const t = useTranslations('activity');
  const locale = useLocale();
  const markRead = useMarkNotificationRead();

  const handleClick = () => {
    if (item.readAt) return;
    markRead.mutate([item.id]);
  };

  return (
    <Link
      href={notificationHref(item)}
      onClick={handleClick}
      className={cn(
        'flex items-start gap-3 border-kallo-border border-b px-4 py-3.5 transition-colors last:border-b-0 hover:bg-kallo-hover/50',
        isNew && 'bg-kallo-hover/30'
      )}
    >
      <NotificationAvatars item={item} fallbackLabel={t('someone')} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-sans-display text-[15px] leading-[1.45]',
            item.readAt ? 'text-kallo-text-muted' : 'text-kallo-text'
          )}
        >
          <NotificationMessage item={item} fallbackLabel={t('someone')} />
        </p>
        <span className="font-sans-display text-[13px] text-kallo-text-muted">
          {formatElapsed(item.createdAt, locale)}
        </span>
      </div>
      {isNew && (
        <span
          aria-hidden="true"
          className="mt-2 size-2 shrink-0 rounded-full bg-kallo-accent"
        />
      )}
    </Link>
  );
}

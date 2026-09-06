'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMarkNotificationRead } from '@/hooks/notifications/use-notification-state';
import { Link } from '@/i18n/navigation';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import { cn } from '@/lib/core/ui/cn';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import { notificationHref } from './notification-copy';
import { NotificationAvatars, NotificationMessage } from './notification-parts';

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

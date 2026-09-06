'use client';

// The two pieces every activity row is built from, whichever row it is. Both
// the plain NotificationRow and the actionable ShareInviteRow render the same
// avatar stack and the same templated sentence — only what sits UNDER them
// differs (an elapsed time, or Accept / Dismiss). They live here so neither row
// owns the other's presentation.

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ProfileAvatar } from '@/components/shared/profile-avatar';
import { cn } from '@/lib/core/ui/cn';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import { actorLabel, messageKey, messageValues } from './notification-copy';

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

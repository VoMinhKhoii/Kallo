'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useMarkNotificationRead } from '@/hooks/notifications/use-notification-state';
import {
  useAcceptMealShareInvite,
  useDismissMealShareInvite,
} from '@/hooks/social/sharing/use-meal-share-invites';
import { formatElapsed } from '@/lib/core/date/format-elapsed';
import { cn } from '@/lib/core/ui/cn';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import { notificationKeys } from '@/lib/domain/notifications/query-keys';
import { inviteMode } from './notification-copy';
import { NotificationAvatars, NotificationMessage } from './notification-parts';

/** The invite's terminal state, as a quiet chip. Only "accepted" names an act:
 *  everything else — dismissed here, dismissed elsewhere, auto-dismissed
 *  because the sender split the same meal with someone else, or gone entirely
 *  (`null` invite / missing object id) — collapses to one neutral "no longer
 *  available" chip. The client cannot tell a self-dismiss from an automatic
 *  one, so it must not imply the reader acted. */
function statusKey(status: string | undefined): string {
  if (status === 'accepted') return 'invite.status.accepted';
  return 'invite.status.unavailable';
}

/**
 * The one actionable row in the feed: a `share.invite` whose live
 * `meal_share_invites.status` is still pending gets Accept / Dismiss inline.
 * The notification never owns that state — acting from Circle, another device,
 * or here all land on the same guarded mutation, so a resolved invite collapses
 * to a status chip wherever it is rendered.
 */
export function ShareInviteRow({
  item,
  isNew,
}: {
  item: NotificationItem;
  isNew: boolean;
}) {
  const t = useTranslations('activity');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const accept = useAcceptMealShareInvite();
  const dismiss = useDismissMealShareInvite();
  const markRead = useMarkNotificationRead();

  const inviteId = item.objectId;
  const pending = item.invite?.status === 'pending' && inviteId !== null;
  const busy = accept.isPending || dismiss.isPending;
  const mode = inviteMode(item);

  // The shared invite hooks refresh the circle surfaces; the activity feed and
  // its badge are ours to refresh on top of them.
  //
  // Acting on the offer also READS this row, so the card dims immediately.
  // The durable close is server-side: accept/dismiss close the aggregate in
  // the same transaction as the status transition (closeAggregates),
  // which is what covers resolutions this card never sees — Circle, another
  // device, a split's auto-dismiss. This markRead is the optimistic half and a
  // harmless second close (the server predicate is `read_at IS NULL`).
  // Fire-and-forget — the mutation dims optimistically and rolls itself back;
  // the feed refresh rides on its settle so the refetch cannot outrun the
  // write and paint the row unread again.
  const settleActivity = () => {
    markRead.mutate([item.id], {
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    });
  };

  const handleAccept = () => {
    if (busy || !inviteId) return;
    accept.mutate(inviteId, {
      onSuccess: settleActivity,
      onError: () => toast.error(t('invite.error')),
    });
  };

  const handleDismiss = () => {
    if (busy || !inviteId) return;
    dismiss.mutate(inviteId, {
      onSuccess: settleActivity,
      onError: () => toast.error(t('invite.error')),
    });
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-kallo-border border-b px-4 py-3.5 last:border-b-0',
        isNew && 'bg-kallo-hover/30'
      )}
    >
      <NotificationAvatars item={item} fallbackLabel={t('someone')} />
      <div className="min-w-0 flex-1">
        <p className="font-sans-display text-[15px] text-kallo-text leading-[1.45]">
          <NotificationMessage item={item} fallbackLabel={t('someone')} />
        </p>
        <div className="flex flex-wrap items-center gap-x-2 font-sans-display text-[13px] text-kallo-text-muted">
          <span>{formatElapsed(item.createdAt, locale)}</span>
          {mode && (
            <span>
              {mode === 'split' ? t('invite.modeSplit') : t('invite.modeCopy')}
            </span>
          )}
        </div>

        {pending ? (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={busy}
              aria-busy={accept.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-kallo-hover px-3.5 py-1.5 font-medium font-sans-display text-[12px] text-kallo-text transition-colors hover:bg-kallo-hover/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {accept.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {t('invite.accept')}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium font-sans-display text-[12px] text-kallo-text-muted transition-colors hover:bg-kallo-hover/40 hover:text-kallo-text disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              {t('invite.dismiss')}
            </button>
          </div>
        ) : (
          <span className="mt-2 inline-flex rounded-full bg-kallo-hover px-2.5 py-0.5 font-medium font-sans-display text-[11px] text-kallo-text-muted">
            {t(statusKey(item.invite?.status))}
          </span>
        )}
      </div>
    </div>
  );
}

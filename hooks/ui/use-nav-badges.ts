'use client';

import { useUnseenNotificationCount } from '@/hooks/notifications/use-notification-badge';
import { useMealShareInviteCount } from '@/hooks/social/sharing/use-meal-share-invites';

/**
 * The ambient dot counts behind the nav, keyed by `NavItemConfig.id`.
 *
 * One place so the rail, the drawer and the mobile header can never disagree
 * about which destination is carrying unread state. Ids with no badge source
 * are simply absent — callers read `counts[id] ?? 0`.
 */
export function useNavBadgeCounts(): Record<string, number> {
  const inviteCount = useMealShareInviteCount();
  const unseenCount = useUnseenNotificationCount();
  return { groups: inviteCount, activity: unseenCount };
}

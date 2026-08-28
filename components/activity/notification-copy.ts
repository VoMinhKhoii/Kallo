import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import type { NotificationType } from '@/lib/domain/notifications/types';

/** i18n key stem per type — the `activity.row.*` message groups. The wire
 *  types are dot-namespaced (`share.reaction`), which next-intl would read as
 *  nesting, so the message catalogue uses camelCase stems instead. */
const MESSAGE_STEM: Record<NotificationType, string> = {
  'friend.joined': 'friendJoined',
  'group.added': 'groupAdded',
  'share.invite': 'shareInvite',
  'share.invite_accepted': 'shareInviteAccepted',
  'share.reaction': 'shareReaction',
  'share.reply': 'shareReply',
  'share.logged': 'shareLogged',
};

/** The three types that collapse into "X and N others…" per object. The rest
 *  are always one distinct human action toward you (docs/NOTIFICATIONS.md —
 *  calibration), so they never get an aggregate template. */
const AGGREGATED: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'share.reaction',
  'share.reply',
  'share.logged',
]);

/** How a person is labelled in a row: display name, else their handle. */
export function actorLabel(item: NotificationItem, fallback: string): string {
  const actor = item.actors[0];
  if (!actor) return fallback;
  return actor.displayName?.trim() || actor.handle || fallback;
}

/** `row.<stem>.<one|other>` — `other` only where the type aggregates AND more
 *  than one actor is actually behind the row. */
export function messageKey(item: NotificationItem): string {
  const stem = MESSAGE_STEM[item.type];
  const plural = AGGREGATED.has(item.type) && item.actorCount > 1;
  return `row.${stem}.${plural ? 'other' : 'one'}`;
}

/** Values every row template may interpolate. `count` is the number of actors
 *  BEHIND the named one ("and 2 others"), not the total. */
export function messageValues(
  item: NotificationItem,
  name: string
): { name: string; count: number; group: string } {
  const groupName = item.data?.groupName;
  return {
    name,
    count: Math.max(0, item.actorCount - 1),
    group: typeof groupName === 'string' ? groupName : '',
  };
}

/** Where tapping the row goes. Only group adds have a destination of their
 *  own; everything else in the v1 catalogue lives on the Circle surface. */
export function notificationHref(item: NotificationItem): string {
  if (item.type === 'group.added' && item.targetId) {
    return `/circle/g/${item.targetId}`;
  }
  return '/circle';
}

/** The copy/split context an invite row shows, when the producer recorded it. */
export function inviteMode(item: NotificationItem): 'copy' | 'split' | null {
  const mode = item.data?.mode;
  return mode === 'copy' || mode === 'split' ? mode : null;
}

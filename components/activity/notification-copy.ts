import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import type { NotificationType } from '@/lib/domain/notifications/types';
import {
  circleGroupHref,
  circleThreadHref,
} from '@/lib/domain/social/circle-routes';

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

/** `row.<type>.<one|other>` — the wire type IS the key path, because the
 *  catalogue nests `share.reaction` exactly the way next-intl reads a dotted
 *  key. `other` only where the type aggregates AND more than one actor is
 *  actually behind the row. */
export function messageKey(item: NotificationItem): string {
  const plural = AGGREGATED.has(item.type) && item.actorCount > 1;
  return `row.${item.type}.${plural ? 'other' : 'one'}`;
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

/** Where tapping the row goes. A group add opens the group; anything about one
 *  share opens THAT share's page, so a reply notification lands on the reply
 *  and not on a feed the user then has to search. The rest of the v1 catalogue
 *  has no destination finer than the Circle surface itself.
 *
 *  The routing question is "is this row's object a share?", and the payload
 *  already answers it: `objectType: 'share'` is written by exactly the three
 *  share producers (`lib/actions/meal-sharing/{reactions,replies,log-shared}`),
 *  while `share.invite_accepted` records an `'invite'`. A parallel set of types
 *  would be a second, driftable copy of that discriminant — the plural-copy
 *  policy above is a separate question and stays a separate set. Mobile routes
 *  the same way (`push_tap_routing.dart`). */
export function notificationHref(item: NotificationItem): string {
  if (item.type === 'group.added' && item.targetId) {
    return circleGroupHref(item.targetId);
  }
  if (item.objectType === 'share' && item.objectId) {
    return circleThreadHref(item.objectId);
  }
  return '/circle';
}

/** The copy/split context an invite row shows, when the producer recorded it. */
export function inviteMode(item: NotificationItem): 'copy' | 'split' | null {
  const mode = item.data?.mode;
  return mode === 'copy' || mode === 'split' ? mode : null;
}

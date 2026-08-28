// ---------------------------------------------------------------------------
// Notifications — close a `share.invite` aggregate when the offer resolves
// ---------------------------------------------------------------------------
// The invite card is the one ACTIONABLE notification, and the notification
// never owns the invite's state — it renders `meal_share_invites.status` live.
// That makes resolution a DOMAIN event, not a UI one: the row must close
// wherever the offer is resolved, so the domain action closes its own
// notification instead of leaving it to whichever surface happened to be open.
//
// Without this the only read edge would be the Activity card's client-side
// markRead, and an invite accepted from the Circle page, from another device,
// or auto-dismissed by the sender's split would leave `read_at` null forever:
// the aggregate never closes, and a later re-offer would land on that same open
// row and REWRITE it instead of inserting fresh history beside it — the
// "read rows are immutable history" invariant of the lifecycle FSM.
//
// Called inside the producer's own transaction, exactly like notify(), so a
// notification can never be closed for a status transition that rolled back.

import { and, eq, isNull, sql } from 'drizzle-orm';
import { notifications } from '@/lib/infra/db/schema';
import { shareInviteKey } from './group-keys';
import type { NotifyDb } from './notify';

/**
 * Close the recipient's OPEN `share.invite` aggregate for one source meal.
 *
 * Scoped to the recipient (the resolver is the addressee — never a cross-tenant
 * write; the Drizzle handle bypasses RLS) and keyed by the source meal, which
 * is what `shareInviteKey` aggregates on. `read_at IS NULL` makes it idempotent:
 * a second close — the Activity card's own markRead, a retried mutation, an
 * accept racing an auto-dismiss — matches zero rows rather than restamping
 * history. Dismissed rows are already out of the open set and stay untouched.
 */
export async function closeInviteNotification(
  tx: NotifyDb,
  input: { recipientId: string; sourceMealId: string }
): Promise<void> {
  await tx
    .update(notifications)
    .set({
      readAt: sql`now()`,
      // A read row also counts as seen, but an existing sighting time survives
      // (mirrors markRead).
      seenAt: sql`COALESCE(${notifications.seenAt}, now())`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(notifications.recipientId, input.recipientId),
        eq(notifications.groupKey, shareInviteKey(input.sourceMealId)),
        isNull(notifications.readAt),
        isNull(notifications.dismissedAt)
      )
    );
}

// ---------------------------------------------------------------------------
// Notifications — the single write path (fan-out on write, inside the producer's tx)
// ---------------------------------------------------------------------------
// Every producer calls notify() inside its own transaction, so a notification
// can never exist for a domain write that rolled back. The aggregation itself
// is one INSERT ... ON CONFLICT against the open-aggregate partial unique
// index: while a row is unread and undismissed the conflict fires and the row
// absorbs the new actor; once it is read the index stops matching it and the
// same event opens a fresh row (history stays immutable — see the FSM in
// docs/NOTIFICATIONS.md).
//
// The SET clause below is the whole aggregation policy: the actor moves to the
// front of a deduplicated recency list holding the FULL membership of the
// aggregate (audiences are bounded — ≤10 friends, ≤50 group members — so the
// array stays small, and nobody ever ages out to be re-counted as new or to
// become unretractable); actor_count is derived from that array, so it is
// exactly the distinct actor set size; created_at/seen_at reset so a
// previously-seen aggregate re-surfaces at the top of the feed and re-badges
// exactly once. That same SET clause also stamps `rebadged` from the OLD row's
// seen_at, so the push classification is decided inside the one statement that
// invalidates the evidence for it — and is read straight back out of its
// RETURNING. There is no second query and no row lock to order.

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { notifications } from '@/lib/infra/db/schema';
import type { NotifyInput } from './types';

export type NotifyDb = AppDb | AppTransaction;

/** The incoming actor is always the sole element of `excluded.actor_ids`. */
const INCOMING_ACTOR = sql`excluded.actor_ids[1]`;

/** Built per call rather than once at module scope: the fragments reference
 *  table columns, and producers' unit suites stand the schema in. */
const aggregateSet = () => {
  // Prepend, minus any prior occurrence (so re-reacting does not duplicate the
  // actor). No slice: the array is the aggregate's full membership.
  const nextActorIds = sql`array_prepend(${INCOMING_ACTOR}, array_remove(${notifications.actorIds}, ${INCOMING_ACTOR}))`;
  return {
    actorIds: nextActorIds,
    // Derived, never accumulated: the "and N others" total cannot drift from
    // the membership it describes.
    actorCount: sql`cardinality(${nextActorIds})`,
    // Latest reference wins, but a producer that omits one keeps the stored one.
    objectType: sql`COALESCE(excluded.object_type, ${notifications.objectType})`,
    objectId: sql`COALESCE(excluded.object_id, ${notifications.objectId})`,
    targetType: sql`COALESCE(excluded.target_type, ${notifications.targetType})`,
    targetId: sql`COALESCE(excluded.target_id, ${notifications.targetId})`,
    data: sql`COALESCE(${notifications.data}, '{}'::jsonb) || COALESCE(excluded.data, '{}'::jsonb)`,
    updatedAt: sql`now()`,
    // Re-surface and re-badge: the row returns to the top of the feed and to the
    // unseen count, still as ONE row.
    createdAt: sql`now()`,
    // Was this refresh a seen→unseen re-badge? Inside ON CONFLICT DO UPDATE a
    // bare table reference is the OLD row, evaluated before the SET lands, so
    // this reads the committed pre-upsert seen_at — and it does so INSIDE the
    // statement that overwrites it. That atomicity is the whole point: there is
    // no window between classifying and resetting for another transaction to
    // slip through. Read back via RETURNING on the next line down; never read
    // between statements (see the column comment in schema.ts).
    rebadged: sql`(${notifications.seenAt} IS NOT NULL)`,
    seenAt: sql`NULL`,
  };
};

/**
 * Record one notification per input, aggregating into an open row when one
 * exists. Self-notifications are dropped (Gate 2).
 *
 * Returns the distinct recipients this event should PUSH to. Each input has one
 * of three outcomes, and only two of them buzz a device:
 *
 * - **INSERT** — no open row existed, so a fresh aggregate opened → **push**.
 * - **Refresh of a SEEN row** — the recipient has already visited since the row
 *   last badged, so resetting `seen_at` starts a new visit cycle → **push**
 *   (the re-badge would otherwise be invisible on a device that never buzzed
 *   again and on an app the user has since closed).
 * - **Refresh of an already-UNSEEN row** — the row is still waiting to be
 *   looked at and the device has already knocked for it → **silent**.
 *
 * So a device is knocked at most once per open aggregate *per visit cycle*: the
 * eighth reaction on a meal you have not opened yet is silent, but the first
 * one after you have looked knocks again. The durable record is always the row,
 * never the push.
 */
export async function notify(
  tx: NotifyDb,
  inputs: NotifyInput[]
): Promise<string[]> {
  const wanted = inputs.filter((input) => input.recipientId !== input.actorId);
  if (wanted.length === 0) return [];

  const pushRecipients = new Set<string>();
  // A single statement may not touch the same conflict row twice ("ON CONFLICT
  // DO UPDATE command cannot affect row a second time"), so inputs colliding on
  // (recipient, groupKey) are spread across successive statements instead of
  // being silently collapsed — each still contributes its actor.
  for (const round of splitByConflictKey(wanted)) {
    // Push classification rides INSIDE this one statement — see the `rebadged`
    // note in `aggregateSet()` above for why that atomicity is load-bearing.
    //
    // The VALUES are sorted by (recipientId, groupKey) so every concurrent
    // multi-row upsert acquires its unique-index entries in one deterministic
    // order; two overlapping rounds can then never take the same two entries
    // in opposite orders and deadlock.
    const values = round
      .map((input) => ({
        recipientId: input.recipientId,
        type: input.type,
        actorIds: [input.actorId],
        actorCount: 1,
        objectType: input.objectType ?? null,
        objectId: input.objectId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        groupKey: input.groupKey,
        data: input.data ?? null,
        rebadged: false,
      }))
      .sort(byConflictKey);
    const rows = await tx
      .insert(notifications)
      .values(values)
      .onConflictDoUpdate({
        target: [notifications.recipientId, notifications.groupKey],
        targetWhere: sql`read_at is null and dismissed_at is null`,
        set: aggregateSet(),
      })
      .returning({
        recipientId: notifications.recipientId,
        // Postgres's upsert tell: a row this statement INSERTED has no
        // updating transaction stamped on it, so xmax is 0; a row it took the
        // ON CONFLICT branch on carries the locking xid.
        inserted: sql<boolean>`(xmax = 0)`,
        // Only ever read here, out of the statement that just wrote it.
        rebadged: notifications.rebadged,
      });
    for (const row of rows) {
      if (row.inserted || row.rebadged) pushRecipients.add(row.recipientId);
    }
  }
  return [...pushRecipients];
}

const conflictKey = (row: { recipientId: string; groupKey: string }) =>
  `${row.recipientId}:${row.groupKey}`;

/** Codepoint order, not `localeCompare`: the only thing that matters is that
 *  every process sorts identically, and recipient ids are fixed-width uuids so
 *  ordering the joined key orders the (recipientId, groupKey) tuple. */
function byConflictKey(
  a: { recipientId: string; groupKey: string },
  b: { recipientId: string; groupKey: string }
): number {
  const left = conflictKey(a);
  const right = conflictKey(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Partition inputs into rounds, each holding at most one row per conflict key:
 *  the Nth input sharing a key goes into round N. */
function splitByConflictKey(inputs: NotifyInput[]): NotifyInput[][] {
  const rounds: NotifyInput[][] = [];
  const seenCount = new Map<string, number>();
  for (const input of inputs) {
    const key = conflictKey(input);
    const index = seenCount.get(key) ?? 0;
    seenCount.set(key, index + 1);
    if (!rounds[index]) rounds[index] = [];
    rounds[index].push(input);
  }
  return rounds;
}

/**
 * Close the OPEN aggregate on one group key for a set of recipients, marking it
 * read without telling anybody anything.
 *
 * This is what makes resolution a DOMAIN event rather than a UI one. The
 * actionable `share.invite` card never owns the invite's state — it renders
 * `meal_share_invites.status` live — so the row has to close wherever the offer
 * is resolved: this card, the Circle page, another device, or the sender's
 * split auto-dismissing a third party's offer out from under them. Left open,
 * a later re-offer would land on that same row and REWRITE it instead of
 * inserting fresh history beside it, breaking the "read rows are immutable
 * history" invariant of the lifecycle FSM (docs/NOTIFICATIONS.md).
 *
 * Callers pass the group key themselves, so this helper knows nothing about
 * invites or meals. Scoped to explicit recipients (never a cross-tenant write —
 * the Drizzle handle bypasses RLS) and idempotent via `read_at IS NULL`: a
 * second close — the card's own markRead, a retried mutation, an accept racing
 * an auto-dismiss — matches zero rows rather than restamping history. Dismissed
 * rows are already out of the open set and stay untouched.
 *
 * Called inside the producer's own transaction, exactly like notify(), so a
 * notification can never be closed for a status transition that rolled back.
 */
export async function closeAggregates(
  tx: NotifyDb,
  input: { recipientIds: string[]; groupKey: string }
): Promise<void> {
  if (input.recipientIds.length === 0) return;
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
        inArray(notifications.recipientId, input.recipientIds),
        eq(notifications.groupKey, input.groupKey),
        isNull(notifications.readAt),
        isNull(notifications.dismissedAt)
      )
    );
}

/**
 * Undo one actor's contribution to an OPEN aggregate (un-react) — open means
 * `read_at IS NULL AND dismissed_at IS NULL`, so a merely SEEN row is still
 * retractable. Read rows are immutable history and are never touched —
 * un-liking does not rewrite the past (Instagram behaviour). A no-op only when
 * there is no open row, or when this actor was never part of it; because the
 * aggregate stores its full membership, an actor who is in it can always be
 * removed from it.
 */
export async function retractActor(
  tx: NotifyDb,
  input: { recipientId: string; groupKey: string; actorId: string }
): Promise<void> {
  const updated = await tx
    .update(notifications)
    .set({
      actorIds: sql`array_remove(${notifications.actorIds}, ${input.actorId}::uuid)`,
      actorCount: sql`GREATEST(${notifications.actorCount} - 1, 0)`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(notifications.recipientId, input.recipientId),
        eq(notifications.groupKey, input.groupKey),
        sql`${notifications.readAt} IS NULL`,
        sql`${notifications.dismissedAt} IS NULL`,
        sql`${input.actorId}::uuid = ANY(${notifications.actorIds})`
      )
    )
    .returning({
      id: notifications.id,
      actorCount: notifications.actorCount,
    });

  // At most one row can match: the open-aggregate partial unique index admits a
  // single (recipient, groupKey) row while it is unread and undismissed.
  const [row] = updated;
  if (row && row.actorCount <= 0) {
    await tx.delete(notifications).where(eq(notifications.id, row.id));
  }
}

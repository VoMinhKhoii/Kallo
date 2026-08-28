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
// exactly once.

import { and, eq, sql } from 'drizzle-orm';
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
    seenAt: sql`NULL`,
  };
};

/**
 * Record one notification per input, aggregating into an open row when one
 * exists. Self-notifications are dropped (Gate 2).
 *
 * Returns the distinct recipients whose row was INSERTED — i.e. those for whom
 * this event opened a FRESH aggregate. Phase 4 hands exactly those to the push
 * sender after commit, so a device buzzes at most once per open aggregate: the
 * second reaction on a meal you have not read yet refreshes the in-app row
 * silently instead of re-buzzing, and a seen→unseen re-badge likewise only
 * updates the row. The durable record is always the row, never the push.
 */
export async function notify(
  tx: NotifyDb,
  inputs: NotifyInput[]
): Promise<string[]> {
  const wanted = inputs.filter((input) => input.recipientId !== input.actorId);
  if (wanted.length === 0) return [];

  const freshlyOpened = new Set<string>();
  // A single statement may not touch the same conflict row twice ("ON CONFLICT
  // DO UPDATE command cannot affect row a second time"), so inputs colliding on
  // (recipient, groupKey) are spread across successive statements instead of
  // being silently collapsed — each still contributes its actor.
  for (const round of splitByConflictKey(wanted)) {
    const rows = await tx
      .insert(notifications)
      .values(
        round.map((input) => ({
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
        }))
      )
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
      });
    for (const row of rows) {
      if (row.inserted) freshlyOpened.add(row.recipientId);
    }
  }
  return [...freshlyOpened];
}

/** Partition inputs into rounds, each holding at most one row per conflict key. */
function splitByConflictKey(inputs: NotifyInput[]): NotifyInput[][] {
  const rounds: NotifyInput[][] = [];
  const seen: Set<string>[] = [];
  for (const input of inputs) {
    const key = `${input.recipientId}:${input.groupKey}`;
    let index = 0;
    while (seen[index]?.has(key)) index += 1;
    if (!rounds[index]) {
      rounds[index] = [];
      seen[index] = new Set();
    }
    rounds[index].push(input);
    seen[index].add(key);
  }
  return rounds;
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

  const emptied = updated.filter((row) => row.actorCount <= 0);
  if (emptied.length === 0) return;
  await tx.delete(notifications).where(eq(notifications.id, emptied[0].id));
}

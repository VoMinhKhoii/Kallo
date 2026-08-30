// ---------------------------------------------------------------------------
// Notifications — the producer wrapper (one transaction, one post-commit push)
// ---------------------------------------------------------------------------
// Every producer that records notifications runs its domain write through
// this. It owns the ordering contract that used to be hand-rolled at eight call
// sites (a hoisted `let pushRecipients`, an assignment inside the tx, and a
// trailing `after(() => sendNotificationPush(...))`):
//
//   1. `run` executes INSIDE db.transaction, so a notification can never exist
//      for a domain write that rolled back.
//   2. Each `notify(...)` inside it performs the row upsert on that same `tx`
//      and QUEUES the push it earned — nothing is sent yet.
//   3. `after()` is scheduled only once the awaited transaction has RESOLVED,
//      so the push is post-commit by construction. A throw inside `run` rolls
//      the transaction back and propagates before `after` is ever reached, so
//      a failed producer pushes nothing.
//
// The push payload is derived from the same NotifyInput the row was written
// from, so the lock-screen notice and the Activity row can never describe
// different events. `extra.actorName` is the one thing a producer may add: it
// is not part of the row, and a producer that already holds the actor's
// display name saves push.ts a profile read.

import { after } from 'next/server';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { notify } from './notify';
import { type NotificationPushPayload, sendNotificationPush } from './push';
import type { NotifyInput } from './types';

/** Anything that can open a transaction — the app handle, or an outer
 *  transaction a caller is already inside (Drizzle nests it as a savepoint). */
export type NotifyTransactional = AppDb | AppTransaction;

/** The scoped writer handed to a producer. Records the rows and remembers the
 *  push; it never sends, so it cannot outrun the commit. */
export type ScopedNotify = (
  inputs: NotifyInput[],
  extra?: { actorName?: string }
) => Promise<void>;

/**
 * Derive the lock-screen payload from the instruction that wrote the row.
 *
 * Only the fields push actually consumes cross over: `objectType`/`objectId`
 * identify the row for the feed, not the device, and the free-form `data` bag
 * is narrowed to the one presentation key the copy templates interpolate
 * (`groupName`, and only when it is really a string — the chat_groups column
 * is nullable and a null must fall through to the anonymous label).
 */
export function toPushPayload(
  input: NotifyInput,
  extra?: { actorName?: string }
): NotificationPushPayload {
  const groupName = input.data?.groupName;
  return {
    type: input.type,
    actor: {
      id: input.actorId,
      ...(extra?.actorName === undefined ? {} : { name: extra.actorName }),
    },
    ...(typeof groupName === 'string' ? { data: { groupName } } : {}),
    ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
    groupKey: input.groupKey,
  };
}

/**
 * Run a producer's transaction with notification fan-out attached.
 *
 * `db` is the producer's own handle (the app singleton, or the one its callers
 * inject) rather than a module-level import, so the injectable-db producers
 * keep working unchanged.
 */
export async function withNotifications<T>(
  db: NotifyTransactional,
  run: (tx: AppTransaction, notify: ScopedNotify) => Promise<T>
): Promise<T> {
  const queued: Array<{
    recipients: string[];
    payload: NotificationPushPayload;
  }> = [];

  const result = await db.transaction(async (tx) => {
    const scoped: ScopedNotify = async (inputs, extra) => {
      if (inputs.length === 0) return;
      const recipients = await notify(tx, inputs);
      // Every input in one call shares its type, actor, target and group key —
      // they differ only in recipient — so the first one describes them all.
      queued.push({ recipients, payload: toPushPayload(inputs[0], extra) });
    };
    return run(tx, scoped);
  });

  // Committed. Sending in parallel is safe: each entry is an independent
  // fan-out, and sendNotificationPush swallows its own failures, so one dead
  // FCM call can never reject the after() task.
  after(() =>
    Promise.all(
      queued.map((entry) =>
        sendNotificationPush(entry.recipients, entry.payload)
      )
    )
  );
  return result;
}

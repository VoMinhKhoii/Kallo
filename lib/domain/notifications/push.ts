// ---------------------------------------------------------------------------
// Notifications — the push fan-out (fire-and-forget, after tx commit)
// ---------------------------------------------------------------------------
// Producers schedule this with next/server's `after()` once their transaction
// has committed, handing over the recipient ids `notify()` returned. That
// ordering is the whole design: the in-app row is the durable record, push is
// a best-effort nudge on top of it. Nothing here may throw — a dead Firebase
// project must never turn a successful meal share into a 500 — so every path
// is wrapped and reported to the log instead.
//
// SECURITY: the Drizzle handle bypasses RLS. Recipient ids arrive from
// notify(), which computed them inside the producer's own authorized tx — or,
// for the row-less chat push, from the producer's own membership read at write
// time; this module only ever reads tokens/locales FOR those ids.

import { eq, inArray } from 'drizzle-orm';
import { RateLimitedError } from '@/lib/core/errors/app-error';
import { db } from '@/lib/infra/db/client';
import {
  publicProfiles,
  pushTokens,
  userProfiles,
} from '@/lib/infra/db/schema';
import { getPushSender } from '@/lib/infra/push/sender';
import type { PushMessage, PushSender } from '@/lib/infra/push/types';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import {
  type PushCopyType,
  type PushCopyValues,
  pushCopy,
  toPushLocale,
} from './push-copy';

/** Longest chat preview that still reads as one glance on a lock screen. */
const PREVIEW_MAX = 140;

export interface NotificationPushPayload {
  type: PushCopyType;
  /** Whoever acted — the subject of every template. `name` is optional: pass
   *  it when the producer already holds the display name, otherwise this
   *  module resolves it from `id` (one extra read, safely after the commit). */
  actor: { id: string; name?: string };
  /** Presentation extras the copy interpolates. Same bag `pushCopy` reads,
   *  minus the actor name, which has its own field above. */
  data?: Omit<PushCopyValues, 'actorName'>;
  /** Where the tap lands, mirrored into the FCM data payload as strings. */
  targetType?: string;
  targetId?: string;
  /** The row this push announces, so the app can mark it read on open. */
  notificationId?: string;
  /** Aggregation identity — becomes the collapse key, so a burst of activity
   *  on one object supersedes itself in the shade instead of stacking. */
  groupKey?: string;
}

/** The flat, all-strings map the Flutter client parses on tap. */
function toDataPayload(
  payload: NotificationPushPayload
): Record<string, string> {
  const data: Record<string, string> = { type: payload.type };
  if (payload.targetType) data.targetType = payload.targetType;
  if (payload.targetId) data.targetId = payload.targetId;
  if (payload.notificationId) data.notificationId = payload.notificationId;
  return data;
}

/**
 * Most producers never load the actor's public profile — they only need the
 * id. Rather than make eight call sites each add a join for a string only push
 * consumes, the name is resolved here, once, after the transaction has already
 * committed. Undefined falls through to the locale's anonymous label.
 */
async function resolveActorName(
  actor: NotificationPushPayload['actor']
): Promise<string | undefined> {
  if (actor.name !== undefined) return actor.name;
  const [row] = await db
    .select({
      displayName: publicProfiles.displayName,
      handle: publicProfiles.handle,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, actor.id))
    .limit(1);
  return row?.displayName?.trim() || row?.handle || undefined;
}

/** One message per registered device, localized per OWNER of that device. */
async function buildMessages(
  recipientIds: string[],
  payload: NotificationPushPayload
): Promise<PushMessage[]> {
  const tokens = await db
    .select({ userId: pushTokens.userId, token: pushTokens.token })
    .from(pushTokens)
    .where(inArray(pushTokens.userId, recipientIds));
  if (tokens.length === 0) return [];

  const profiles = await db
    .select({
      userId: userProfiles.userId,
      preferredLocale: userProfiles.preferredLocale,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, recipientIds));
  const localeByUser = new Map(
    profiles.map((row) => [row.userId, toPushLocale(row.preferredLocale)])
  );

  const data = toDataPayload(payload);
  const actorName = await resolveActorName(payload.actor);
  return tokens.map((row) => {
    const { title, body } = pushCopy(
      payload.type,
      localeByUser.get(row.userId) ?? 'en',
      {
        actorName,
        groupName: payload.data?.groupName,
        preview: payload.data?.preview,
      }
    );
    return {
      token: row.token,
      title,
      body,
      data,
      ...(payload.groupKey ? { collapseKey: payload.groupKey } : {}),
    };
  });
}

/** Throttle for the global-budget skip log: one line per 30s per instance,
 *  so a sustained flood past the hourly cap cannot storm the log. */
let lastPushBudgetLogAt = 0;

/**
 * The app-wide FCM fan-out budget (`pushGlobalHourly`). Charged once per
 * fan-out, immediately before `send` and only when there are messages to send,
 * INSIDE the send path: a block means skip sending and return, never
 * throw. The producer's message/notification row is already committed, so a
 * skipped push is the correct worst case — turning it into a thrown error would
 * fail an already-successful write. The policy is `degraded` with no
 * `perMinute`, so a limiter outage admits rather than blocks.
 *
 * Returns `true` when the budget is exhausted (caller should skip).
 */
async function pushGlobalBudgetExhausted(): Promise<boolean> {
  try {
    await assertRateLimit('pushGlobalHourly', {
      kind: 'global',
      value: 'push',
    });
    return false;
  } catch (error) {
    if (error instanceof RateLimitedError) {
      const now = Date.now();
      if (now - lastPushBudgetLogAt > 30_000) {
        lastPushBudgetLogAt = now;
        console.warn(
          'push fan-out skipped: global hourly budget exhausted (pushGlobalHourly)'
        );
      }
      return true;
    }
    // Anything else is unexpected on a `degraded` policy; let the caller's
    // own try/catch log it and swallow it — push must never throw.
    throw error;
  }
}

/** Drop registrations FCM has told us are permanently dead. */
async function pruneTokens(dead: string[]): Promise<void> {
  if (dead.length === 0) return;
  await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
}

/**
 * Deliver one notification to every device of every recipient. Safe to call
 * with an empty recipient list (the common case — most events notify nobody
 * with a phone), and safe to call with no FCM configured (the no-op sender).
 */
export async function sendNotificationPush(
  recipientIds: string[],
  payload: NotificationPushPayload,
  sender?: PushSender
): Promise<void> {
  try {
    const unique = [...new Set(recipientIds)];
    if (unique.length === 0) return;
    const messages = await buildMessages(unique, payload);
    // Most events notify nobody with a registered device. Returning here BEFORE
    // charging the budget is the point: the counter is an FCM fan-out budget,
    // and every recipient-with-no-token used to spend one unit of it, so the
    // hourly ceiling was reached by traffic that never sent a push. On a block
    // the send is skipped — the row/message is already committed.
    if (messages.length === 0) return;
    if (await pushGlobalBudgetExhausted()) return;
    // Resolved INSIDE the try, never as a default argument: default arguments
    // evaluate before the function body, so a malformed
    // FCM_SERVICE_ACCOUNT_JSON would throw past this boundary and reject the
    // after() task on an already-successful request.
    const resolved = sender ?? getPushSender();
    const results = await resolved.send(messages);
    await pruneTokens(
      results.filter((result) => result.shouldPrune).map((r) => r.token)
    );
  } catch (error) {
    // Push is advisory. The notification row (or, for chat, the message) is
    // already committed and the in-app surfaces will show it regardless.
    console.error('sendNotificationPush failed', error);
  }
}

/**
 * The push-only chat event (Gate 3): chat unread already has a surface in
 * `chat_group_members.lastReadAt`, so a message must never create a
 * notification row — but it is still the one thing people expect their phone
 * to buzz for. Fan-out is the group's members minus the sender, as the
 * producer captured them at write time — this module only loads their tokens
 * and locales.
 */
export async function sendChatMessagePush(
  input: {
    groupId: string;
    senderId: string;
    senderName?: string;
    preview: string;
    /** The audience, captured by the producer at WRITE time (sender already
     *  excluded). Resolving it here instead would read the membership as it
     *  stands after the commit, so somebody who joined in between would get a
     *  preview of a message sent before they were in the room. */
    recipientIds: string[];
  },
  sender?: PushSender
): Promise<void> {
  // No try/catch of its own: `sendNotificationPush` already swallows every
  // failure below it, and nothing here can throw on the way in.
  await sendNotificationPush(
    input.recipientIds,
    {
      type: 'chat.message',
      actor: { id: input.senderId, name: input.senderName },
      data: { preview: input.preview.slice(0, PREVIEW_MAX) },
      targetType: 'chat_group',
      targetId: input.groupId,
      // One conversation, one live notice — the newest message replaces the
      // one before it rather than filling the shade with a transcript.
      groupKey: `chat:${input.groupId}`,
    },
    sender
  );
}

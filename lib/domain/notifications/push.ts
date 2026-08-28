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
// notify(), which computed them inside the producer's own authorized tx; this
// module only ever reads tokens/locales FOR those ids.

import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/infra/db/client';
import {
  chatGroupMembers,
  publicProfiles,
  pushTokens,
  userProfiles,
} from '@/lib/infra/db/schema';
import { getPushSender } from '@/lib/infra/push/sender';
import type { PushMessage, PushSender } from '@/lib/infra/push/types';
import { type PushCopyType, pushCopy, toPushLocale } from './push-copy';

/** Longest chat preview that still reads as one glance on a lock screen. */
const PREVIEW_MAX = 140;

export interface NotificationPushPayload {
  type: PushCopyType;
  /** Display name of whoever acted — the subject of every template. Pass it
   *  when the producer already holds it; otherwise pass `actorId` and this
   *  module resolves it (one extra read, safely after the commit). */
  actorName?: string;
  /** Fallback source for `actorName`. */
  actorId?: string;
  /** Presentation extras the copy may use (currently `groupName`). */
  data?: { groupName?: string; preview?: string };
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
  payload: NotificationPushPayload
): Promise<string | undefined> {
  if (!payload.actorId) return undefined;
  const [row] = await db
    .select({
      displayName: publicProfiles.displayName,
      handle: publicProfiles.handle,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, payload.actorId))
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
  const actorName = payload.actorName ?? (await resolveActorName(payload));
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
  sender: PushSender = getPushSender()
): Promise<void> {
  try {
    const unique = [...new Set(recipientIds)];
    if (unique.length === 0) return;
    const messages = await buildMessages(unique, payload);
    if (messages.length === 0) return;
    const results = await sender.send(messages);
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
 * to buzz for. Fan-out is the group's members minus the sender.
 */
export async function sendChatMessagePush(
  input: {
    groupId: string;
    senderId: string;
    senderName?: string;
    preview: string;
  },
  sender: PushSender = getPushSender()
): Promise<void> {
  try {
    const members = await db
      .select({ userId: chatGroupMembers.userId })
      .from(chatGroupMembers)
      .where(
        and(
          eq(chatGroupMembers.groupId, input.groupId),
          ne(chatGroupMembers.userId, input.senderId)
        )
      );
    if (members.length === 0) return;
    await sendNotificationPush(
      members.map((member) => member.userId),
      {
        type: 'chat.message',
        actorName: input.senderName,
        actorId: input.senderId,
        data: { preview: input.preview.slice(0, PREVIEW_MAX) },
        targetType: 'chat_group',
        targetId: input.groupId,
        // One conversation, one live notice — the newest message replaces the
        // one before it rather than filling the shade with a transcript.
        groupKey: `chat:${input.groupId}`,
      },
      sender
    );
  } catch (error) {
    console.error('sendChatMessagePush failed', error);
  }
}

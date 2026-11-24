import { and, desc, eq, inArray, or, type SQL, sql } from 'drizzle-orm';
import { db } from '@/lib/infra/db/client';
import { pushTokens, userProfiles } from '@/lib/infra/db/schema';
import type { PushSendResult } from '@/lib/infra/push/types';
import type { PushTokenBody } from './contracts';

/**
 * The one owner of `push_tokens` rows: registering a device, reading who can
 * be reached, and booking what APNs said. Every push path (activity, chat,
 * reminders) and the registration route go through here.
 *
 * SECURITY: the Drizzle handle bypasses RLS; callers pass ids they already
 * authorized.
 */

/** A user keeps at most this many devices; older registrations are pruned. */
const MAX_DEVICES = 10;

/**
 * Register (or refresh) a device for `userId`. The APNs token is unique across
 * the table because the OS hands the same string to whoever signs in on that
 * handset next: the conflict update REASSIGNS the row rather than leaving a
 * stale owner receiving the new user's notifications. Keeps the user's ten
 * most recent devices, under a per-user advisory lock so concurrent
 * registrations cannot both escape the prune.
 *
 * `last_seen_at` is refreshed on every call — the app posts on launch and on
 * every return to the foreground, so it is also the reminder gates' "opened
 * Kallo". The reported time zone, when there is one, becomes the clock
 * reminders run on, and the reported language becomes `preferred_locale`, the
 * language pushes are written in: the app registers the lock-screen buttons in
 * its own language, so the text must follow the phone. The newest device to
 * check in wins; each is written on a change only.
 */
export async function registerDevice(
  userId: string,
  body: PushTokenBody
): Promise<void> {
  await db.transaction(async (tx) => {
    // Serialize registrations even when this user has no token rows yet.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`push-tokens:${userId}`}))`
    );
    const lastSeenAt = new Date();
    await tx
      .insert(pushTokens)
      .values({
        userId,
        token: body.token,
        platform: body.platform,
        lastSeenAt,
      })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId,
          platform: body.platform,
          // The liveness signal the 270-day retention reap reads.
          lastSeenAt,
        },
      });
    const oldest = tx
      .select({ id: pushTokens.id })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId))
      .orderBy(
        desc(pushTokens.lastSeenAt),
        // Keep this registration when two refreshes share a millisecond.
        sql`${pushTokens.token} = ${body.token} desc`,
        desc(pushTokens.id)
      )
      .offset(MAX_DEVICES);
    await tx
      .delete(pushTokens)
      .where(
        and(eq(pushTokens.userId, userId), inArray(pushTokens.id, oldest))
      );
    const profile: { timeZone?: string; preferredLocale?: string } = {};
    const changed: SQL[] = [];
    if (body.timeZone) {
      profile.timeZone = body.timeZone;
      changed.push(
        sql`${userProfiles.timeZone} IS DISTINCT FROM ${body.timeZone}`
      );
    }
    if (body.locale) {
      profile.preferredLocale = body.locale;
      changed.push(
        sql`${userProfiles.preferredLocale} IS DISTINCT FROM ${body.locale}`
      );
    }
    if (changed.length > 0) {
      await tx
        .update(userProfiles)
        .set(profile)
        .where(and(eq(userProfiles.userId, userId), or(...changed)));
    }
  });
}

/**
 * Every iOS device of these users. APNs is the only transport; the column
 * CHECK still admits other platforms, so filter here rather than spend a send
 * on a token Apple would reject.
 */
export async function loadIosTokens(
  userIds: string[]
): Promise<{ userId: string; token: string }[]> {
  if (userIds.length === 0) return [];
  return db
    .select({ userId: pushTokens.userId, token: pushTokens.token })
    .from(pushTokens)
    .where(
      and(inArray(pushTokens.userId, userIds), eq(pushTokens.platform, 'ios'))
    );
}

/**
 * Book what APNs said about a batch: delete the registrations Apple called
 * permanently dead, and stamp `last_pushed_at` on the ones it accepted — the
 * reminder tick spaces itself 30 minutes away from any other push by that
 * stamp.
 *
 * Throws on a database error; every caller already runs inside its own
 * never-throw boundary.
 */
export async function recordPushResults(
  results: PushSendResult[],
  now: Date = new Date()
): Promise<void> {
  const dead = results.filter((r) => r.shouldPrune).map((r) => r.token);
  const delivered = results.filter((r) => r.ok).map((r) => r.token);
  if (dead.length > 0) {
    await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
  }
  if (delivered.length > 0) {
    await db
      .update(pushTokens)
      .set({ lastPushedAt: now })
      .where(inArray(pushTokens.token, delivered));
  }
}

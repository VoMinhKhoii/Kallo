import { inArray } from 'drizzle-orm';
import { db } from '@/lib/infra/db/client';
import { pushTokens } from '@/lib/infra/db/schema';
import type { PushSendResult } from '@/lib/infra/push/types';

/**
 * Book what APNs said about a batch, for every push path (activity, chat,
 * reminders): delete the registrations Apple called permanently dead, and
 * stamp `last_pushed_at` on the ones it accepted — the reminder tick spaces
 * itself 30 minutes away from any other push by that stamp.
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

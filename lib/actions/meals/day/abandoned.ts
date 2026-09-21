import { sql } from 'drizzle-orm';
import { pendingAnalyses } from '@/lib/infra/db/schema';

/**
 * How long past `expires_at` a staged card survives before the sweep takes it.
 *
 * `expires_at` itself defaults to 30 minutes but stopped hiding anything years
 * ago, so this window IS a staged card's real lifetime: it stays visible and
 * confirmable for about a week after staging, then the sweep deletes it.
 */
const ABANDONED_AFTER = "interval '7 days'";

/**
 * Rows the sweep will delete.
 *
 * This and {@link isStillStaged} are complements over a NOT NULL column, and
 * they live together because the day read and the sweep MUST agree on where
 * the line is. They run concurrently — and across overlapping requests, on
 * rows either one may already have deleted — so any drift between them is a
 * card that renders and then fails every confirm and discard.
 *
 * Built per call rather than shared as one `sql` object: Drizzle
 * re-parameterizes a reused fragment, which is the same trap documented on
 * `loadMealDates`.
 */
export function isAbandoned() {
  return sql`${pendingAnalyses.expiresAt} < now() - ${sql.raw(ABANDONED_AFTER)}`;
}

/**
 * Rows a day read may still show — the complement of {@link isAbandoned}.
 *
 * This is NOT the old `expiresAt > now()` filter, which hid a card 30 minutes
 * after staging while the user still meant to save it. It hides only cards
 * already past the reaping horizon: rows that are about to stop existing, or
 * that only still exist because a best-effort sweep failed. Without it the
 * read returns exactly the rows some sweep is deleting, and which of them a
 * user sees comes down to which query reached the connection pool first.
 */
export function isStillStaged() {
  return sql`${pendingAnalyses.expiresAt} >= now() - ${sql.raw(ABANDONED_AFTER)}`;
}

// ---------------------------------------------------------------------------
// Blocks — the read-side rule: who must not see whom
// ---------------------------------------------------------------------------
// A block is a DIRECTED user_blocks row (blocker → blocked), but the rule it
// imposes is symmetric: a row in either direction hides both people from each
// other everywhere. That symmetry lives here, once, as a SQL predicate every
// cross-user read folds into its own WHERE — share visibility
// (shares/share-visibility.ts), chat messages (chat/message-visibility.ts),
// replies, reactions, reply/chat push audiences, notifications. There is
// deliberately no in-memory form: a second shape of the rule is a second
// thing to keep correct.
//
// Blocking also deletes the pair's friendships row (lib/actions/moderation/
// blocks.ts), so the friend branch of every rule ends by construction; this
// predicate is what covers the rest — named groups the two still share.

import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { userBlocks } from '@/lib/infra/db/schema';

type UserRef = SQLWrapper | string;

/**
 * True when `a` and `b` are in a blocked relation — either one blocked the
 * other. Each side may be a column (the author of the row being read) or a
 * literal id. Every column is table-qualified: this is embedded in
 * `db.execute` statements where a bare name could be ambiguous (42702).
 */
export function blockedBetweenSql(a: UserRef, b: UserRef): SQL<boolean> {
  return sql<boolean>`
    EXISTS (
      SELECT 1
      FROM ${userBlocks}
      WHERE (${userBlocks.blockerId} = ${a} AND ${userBlocks.blockedId} = ${b})
         OR (${userBlocks.blockerId} = ${b} AND ${userBlocks.blockedId} = ${a})
    )
  `;
}

/** The negation, for a read's WHERE: keep only rows whose author is not
 * blocked with the viewer. A user is never blocked with themselves (the
 * table's CHECK), so the viewer's own rows always pass. */
export function notBlockedWithSql(a: UserRef, b: UserRef): SQL<boolean> {
  return sql<boolean>`NOT ${blockedBetweenSql(a, b)}`;
}

/**
 * The transaction-scoped lock that serialises everything which can create or
 * end a relationship between one pair — blocking, and accepting an invite.
 * Without it an accept that checked "no block" could commit its friendship
 * right after a concurrent block committed, leaving the pair friends despite
 * the block. Keyed on the ORDERED pair so both directions take the same lock.
 */
export function lockPairSql(userLow: string, userHigh: string): SQL {
  return sql`SELECT pg_advisory_xact_lock(hashtextextended(${`friend-pair:${userLow}:${userHigh}`}, 0))`;
}

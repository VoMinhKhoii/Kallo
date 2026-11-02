// ---------------------------------------------------------------------------
// Removals — a removed friend cannot reconnect on their own
// ---------------------------------------------------------------------------
// Removing a friend (lib/actions/groups/friendship.ts) records a DIRECTED
// friend_removals row (remover → removed) with the edge delete. The row is the
// remover's withdrawn consent: their invite link no longer connects the person
// they removed. Unlike a block it hides nothing and only one direction counts —
// the removed person's own link still works for the remover, and the remover
// accepting it is the fresh consent that clears the row.

import { and, eq } from 'drizzle-orm';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { friendRemovals } from '@/lib/infra/db/schema';

type Db = Pick<AppDb | AppTransaction, '$count'>;

/** True when `removerId` removed `removedId` and has not reconnected since. */
export async function hasRemoved(
  db: Db,
  removerId: string,
  removedId: string
): Promise<boolean> {
  return (
    (await db.$count(
      friendRemovals,
      and(
        eq(friendRemovals.removerId, removerId),
        eq(friendRemovals.removedId, removedId)
      )
    )) > 0
  );
}

// ---------------------------------------------------------------------------
// Group tracking — meal share visibility toggle
// ---------------------------------------------------------------------------
// The per-meal share control. Meals are private unless the owner turned Circle
// auto-share on (off by default), in which case every meal-creation path
// (confirm, manual log, re-log) inserts a 'circle' meal_shares row — so this
// toggle is the per-meal opt-in, or the opt-out for an auto-shared meal. A
// re-share bumps shared_at, so a friend who connected after the meal was first
// logged sees it only once it is deliberately shared again. Toggling upserts a
// single row on the partial-unique meal_id, and
// the DB AFTER INSERT OR UPDATE trigger on meal_shares writes the meal_shared
// circle_event on the private -> non-private transition (so re-shares fan out
// too).

import { and, eq, sql } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import { setMealShareVisibilitySchema } from '@/lib/core/validation/social';
import { assertShareableMealText } from '@/lib/domain/social/shares/shareable-meal';
import { db as defaultDb } from '@/lib/infra/db/client';
import { mealShares, meals } from '@/lib/infra/db/schema';

type Db = typeof defaultDb;

export async function setMealShareVisibility(
  actorId: string,
  input: { mealId: string; visibility: 'private' | 'circle' },
  db: Db = defaultDb
): Promise<{
  mealId: string;
  visibility: 'private' | 'circle';
  shareId: string;
}> {
  const parsed = setMealShareVisibilitySchema.parse(input);

  // Defense in depth beyond RLS: the meal must belong to the actor.
  const owned = await db
    .select({ id: meals.id, rawInput: meals.rawInput })
    .from(meals)
    .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, actorId)))
    .limit(1);
  if (!owned[0]) {
    throw Errors.notFound('Bữa ăn không tồn tại hoặc không thuộc về bạn.');
  }
  // Sharing makes the meal's text visible to friends: it must pass the
  // objectionable-content filter (422). Making a meal private never does.
  if (parsed.visibility !== 'private') {
    assertShareableMealText(owned[0].rawInput);
  }

  // Upsert on the partial-unique meal_id. The DB trigger fans out the event
  // (only for non-private rows), so we never write circle_events here. The
  // returned row id is the shareId used to key the shareable Macro Card.
  const [row] = await db
    .insert(mealShares)
    .values({
      mealId: parsed.mealId,
      actorId,
      visibility: parsed.visibility,
    })
    .onConflictDoUpdate({
      target: mealShares.mealId,
      // The database clock, not the app server's: shared_at is compared with
      // friendships.accepted_at, which the DB stamps (20260923051230).
      set: { visibility: parsed.visibility, sharedAt: sql`now()` },
    })
    .returning({ id: mealShares.id });

  return {
    mealId: parsed.mealId,
    visibility: parsed.visibility,
    shareId: row.id,
  };
}

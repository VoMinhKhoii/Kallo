// ---------------------------------------------------------------------------
// Group tracking — meal share visibility toggle
// ---------------------------------------------------------------------------
// The per-meal opt-in share control. visibility defaults to 'private'; toggling
// to 'circle' upserts a single row on the partial-unique meal_id, and the DB
// AFTER INSERT OR UPDATE trigger on meal_shares writes the meal_shared
// circle_event on the private -> non-private transition (so re-shares fan out
// too). No always-share shortcut: every share is a deliberate per-meal act.

import { and, eq } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import { mealShares, meals } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { setMealShareVisibilitySchema } from '@/lib/validation';

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
    .select({ id: meals.id })
    .from(meals)
    .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, actorId)))
    .limit(1);
  if (!owned[0]) {
    throw Errors.notFound('Bữa ăn không tồn tại hoặc không thuộc về bạn.');
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
      set: { visibility: parsed.visibility, sharedAt: new Date() },
    })
    .returning({ id: mealShares.id });

  return {
    mealId: parsed.mealId,
    visibility: parsed.visibility,
    shareId: row.id,
  };
}

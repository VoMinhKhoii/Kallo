import {
  buildPersistedMeal,
  inferMealSlot,
} from '@/lib/actions/logging/persisted-meal';
import type {
  CheatSliderLevels,
  CheatSliderSpec,
  CheatSlidersPersisted,
} from '@/lib/core/types/cheat';
import { resolveSliderNutrition } from '@/lib/domain/cheat/slider-nutrition';
import type { AppDb } from '@/lib/infra/db';
import { meals, type pendingAnalyses } from '@/lib/infra/db/schema';
import { insertDefaultCircleShare } from './insert-default-share';
import { EMPTY_NUTRITION } from './shared';
import type { ConfirmMealResponse } from './types';

type DbTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

/**
 * Cheat-meal confirm branch: recompute nutrition from the staged slider spec
 * + the user's chosen levels (server-authoritative), insert a single meal row
 * with zero meal_items, and store the spec/levels for re-edit.
 */
export async function confirmCheatMeal(args: {
  tx: DbTransaction;
  userId: string;
  pending: typeof pendingAnalyses.$inferSelect;
  mealId: string | undefined;
  levels: CheatSliderLevels;
}): Promise<ConfirmMealResponse> {
  const { tx, userId, pending, mealId } = args;
  const { spec } = pending.pipelineResult as {
    entryMode: 'cheat';
    spec: CheatSliderSpec;
  };
  const levels: CheatSliderLevels = args.levels;
  const resolved = resolveSliderNutrition(spec, levels);

  const loggedAt = pending.loggedAt;
  const mealSlot = spec.mealSlot ?? inferMealSlot(loggedAt);
  const persisted: CheatSlidersPersisted = { spec, levels };

  const [meal] = await tx
    .insert(meals)
    .values({
      ...(mealId ? { id: mealId } : {}),
      userId,
      rawInput: pending.rawInput,
      mealSlot,
      confidenceOverall: spec.confidence,
      loggedAt,
      entryMode: 'cheat',
      caloriesKcal: resolved.caloriesKcal,
      proteinG: resolved.proteinG,
      carbohydrateG: resolved.carbohydrateG,
      fatG: resolved.fatG,
      alcoholG: resolved.alcoholG,
      cheatSliders: persisted,
    })
    .returning({ id: meals.id });

  // Share to circle by default unless the profile-level opt-out is set (the
  // AFTER INSERT trigger fans out the meal_shared circle event). The user can
  // still opt this meal back out via the per-meal toggle, while
  // onConflictDoNothing preserves a prior explicit choice on the
  // re-confirm/edit path (existing meal id).
  const share = await insertDefaultCircleShare(tx, {
    mealId: meal.id,
    actorId: userId,
  });

  // Rebuild the saved cheat meal in the shape loadMealsByDate returns, so
  // the client reconciles its optimistic card from the confirm response
  // (same id → in-place overwrite, no day refetch) — mirroring the precise
  // path in confirmAndSaveMealAction. Cheat meals carry zero meal_items.
  const nutrition = {
    ...EMPTY_NUTRITION,
    caloriesKcal: resolved.caloriesKcal,
    proteinG: resolved.proteinG,
    carbohydrateG: resolved.carbohydrateG,
    fatG: resolved.fatG,
  };
  const savedMeal = buildPersistedMeal({
    id: meal.id,
    rawInput: pending.rawInput,
    mealSlot,
    confidenceOverall: spec.confidence,
    loggedAt: loggedAt.toISOString(),
    nutrition,
    mealItemGroups: [],
    entryMode: 'cheat',
    alcoholG: resolved.alcoholG,
    cheatSliders: persisted,
    share,
  });

  return { mealId: meal.id, meal: savedMeal };
}

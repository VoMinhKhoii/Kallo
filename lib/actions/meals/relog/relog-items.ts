'use server';

import { randomUUID } from 'node:crypto';
import { resolveRelogSources } from '@/lib/actions/meals/relog/resolve-sources';
import type { ConfirmMealResponse } from '@/lib/actions/meals/types';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
  inferMealSlot,
  nutritionValuesToRow,
} from '@/lib/actions/persisted-meal';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/assemble/goal-adjustment';
import {
  type RelogItemsInput,
  relogItemsSchema,
} from '@/lib/api/contracts/meals';
import { requireAuthAndProfile } from '@/lib/auth/session';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { mealItems, meals } from '@/lib/db/schema';
import {
  buildRelogRawInput,
  weakestConfidence,
} from '@/lib/logging/relog/relog';
import {
  RELOG_WRITE_ROUTE,
  withRelogGuard,
} from '@/lib/rate-limit/relog-guard';
import { insertDefaultCircleShare } from '../insert-default-share';

// `relogItemsSchema` lives in the meals contract so the route can reuse it;
// imported here since this 'use server' module may only export async functions.

/**
 * Relog: write ONE new meal composed of dishes the user picked from their own
 * history, copying the stored `meal_items` rows verbatim.
 *
 * No AI pipeline runs. That is a correctness requirement, not just a cost one:
 * `meals`/`meal_items` store GOAL-ADJUSTED macros and carry no goal/aggression
 * snapshot, so a past dish's accepted numbers cannot be recomputed — copying
 * the rows is the only way to reproduce them (the same reasoning recorded on
 * `duplicateMealAction`).
 *
 * Why a sibling of `copyMealVerbatim` rather than an extension of it: that
 * helper's contract is "copy ONE stored meal and its items", deriving
 * rawInput/confidence/alcohol/portionFactor and the meal-level nutrition from
 * that single source row. A relog composes N dishes from up to N different
 * meals, so there is no single source to derive them from, and meal nutrition
 * must be SUMMED from the copied rows rather than taken wholesale. Widening
 * that helper would put a branch inside the one seam accept-share, duplicate
 * and split all depend on. Both paths share the row-level primitives instead.
 *
 * Tenant isolation: Drizzle runs on the owner connection and BYPASSES RLS, so
 * the explicit `user_id` predicate below is the real boundary. Item rows are
 * reached only through meal ids that predicate already proved.
 */
export async function relogMealItemsAction(
  input: RelogItemsInput
): Promise<ConfirmMealResponse> {
  const parsed = relogItemsSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Throttled HERE, not at the route: the web composer calls this action
  // directly, so a route-level guard left that caller unlimited on a path that
  // holds `FOR UPDATE` on the source meals and inserts their rows.
  return withRelogGuard('write', RELOG_WRITE_ROUTE, user.id, async () => {
    const loggedAt = getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    );
    // A relog is a new eating event now, so the slot comes from the new instant
    // rather than being copied — same as duplicate/manual.
    const mealSlot = inferMealSlot(loggedAt);

    return await db.transaction(async (tx) => {
      // Lock the sources (FOR UPDATE) so a concurrent delete can't land between
      // this read and the copy below (mirrors duplicateMealAction).
      const { dishes, sourceConfidences } = await resolveRelogSources(
        tx,
        user.id,
        parsed.items,
        { lock: true }
      );

      // Re-sequence to the flattened dish index. MANDATORY, not cosmetic:
      // buildMealItemGroupsFromRows keys groups on `${order}:${name}`, so two
      // picks of the same dish (each at source order 0) would otherwise merge
      // into a single group and silently halve what the user logged.
      const copies = dishes.flatMap((dish, order) =>
        dish.rows.map((row) => ({
          id: randomUUID(),
          row,
          order,
          nutrition: extractNutritionValues(row),
        }))
      );

      // Meal nutrition is the SUM of the copied rows — never a source meal's
      // stored total, which describes a different set of items.
      const mealNutrition = sumDisplayedNutrition(
        copies.map((c) => c.nutrition)
      );
      // Same derivation the optimistic client card uses — one source of truth.
      const rawInput = buildRelogRawInput(dishes.map((d) => d.name));
      // A composed meal is no more confident than its least confident part.
      const confidenceOverall = weakestConfidence(sourceConfidences);

      const [meal] = await tx
        .insert(meals)
        .values({
          ...(parsed.newMealId ? { id: parsed.newMealId } : {}),
          userId: user.id,
          rawInput,
          mealSlot,
          confidenceOverall,
          loggedAt,
          entryMode: 'precise',
          alcoholG: null,
          portionFactor: 1,
          ...nutritionValuesToRow(mealNutrition),
        })
        .returning({ id: meals.id });

      const share = await insertDefaultCircleShare(tx, {
        mealId: meal.id,
        actorId: user.id,
      });

      await tx.insert(mealItems).values(
        copies.map(({ id, row, order, nutrition }) => ({
          id,
          mealId: meal.id,
          ingredientName: row.ingredientName,
          mealItemName: row.mealItemName,
          mealItemOrder: order,
          foodCompositionId: row.foodCompositionId,
          estimatedGrams: row.estimatedGrams,
          // Copied, not overwritten: matchConfidence/userFacingUnit describe how
          // the ORIGINAL estimate was produced. Stamping manual-mode values here
          // ('g', 1) would claim a precision this meal never had.
          userFacingUnit: row.userFacingUnit,
          cookingMethod: row.cookingMethod,
          matchConfidence: row.matchConfidence,
          ...nutritionValuesToRow(nutrition),
        }))
      );

      const mealItemGroups = buildMealItemGroupsFromRows(
        copies.map(({ id, row, order, nutrition }) => ({
          ...row,
          id,
          mealItemOrder: order,
          nutrition,
        }))
      );

      return {
        mealId: meal.id,
        meal: buildPersistedMeal({
          id: meal.id,
          rawInput,
          mealSlot,
          confidenceOverall,
          loggedAt: loggedAt.toISOString(),
          nutrition: mealNutrition,
          mealItemGroups,
          entryMode: 'precise',
          alcoholG: null,
          cheatSliders: null,
          share,
          portionFactor: 1,
        }),
      };
    });
  });
}

'use server';

import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  RelogResolutionError,
  resolveRelogDishes,
} from '@/lib/actions/meals/relog/expand-refs';
import type { ConfirmMealResponse } from '@/lib/actions/meals/types';
import {
  buildMealItemGroupsFromRows,
  buildPersistedMeal,
  extractNutritionValues,
  inferMealSlot,
  nutritionValuesToRow,
} from '@/lib/actions/persisted-meal';
import { sumDisplayedNutrition } from '@/lib/ai/pipeline/goal-adjustment';
import {
  type RelogItemsInput,
  relogItemsSchema,
} from '@/lib/api/contracts/meals';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { mealItems, meals } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import {
  buildRelogRawInput,
  weakestConfidence,
} from '@/lib/logging/relog/relog';
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

  const sourceIds = [...new Set(parsed.items.map((i) => i.sourceMealId))];
  const loggedAt = getUtcInstantForLocalDate(
    parsed.loggedDate,
    parsed.timezoneOffset
  );
  // A relog is a new eating event now, so the slot comes from the new instant
  // rather than being copied — same as duplicate/manual.
  const mealSlot = inferMealSlot(loggedAt);

  return await db.transaction(async (tx) => {
    const sourceMeals = await tx
      .select({
        id: meals.id,
        entryMode: meals.entryMode,
        portionFactor: meals.portionFactor,
        confidenceOverall: meals.confidenceOverall,
      })
      .from(meals)
      .where(and(eq(meals.userId, user.id), inArray(meals.id, sourceIds)))
      // Lock the sources so a concurrent delete can't land between this read
      // and the copy below (mirrors duplicateMealAction).
      .for('update');

    if (sourceMeals.length !== sourceIds.length) {
      throw Errors.validationFailed(
        'Món ăn không tồn tại hoặc không thuộc về bạn.'
      );
    }
    // Re-assert what the candidate query already filtered on. A stale or
    // hand-crafted reference must not be able to reach a source the picker
    // would never have offered.
    for (const source of sourceMeals) {
      if (source.entryMode === 'cheat') {
        throw Errors.validationFailed(
          'Không thể ghi lại bữa xả theo cách này.'
        );
      }
      // A split share's rows are ALREADY halved, so copying them verbatim under
      // the full dish name would log half a portion as a whole one.
      if (Number(source.portionFactor) !== 1) {
        throw Errors.validationFailed(
          'Không thể ghi lại món đã chia đôi. Hãy ghi lại cả bữa.'
        );
      }
    }

    const sourceRows = await tx
      .select()
      .from(mealItems)
      .where(inArray(mealItems.mealId, sourceIds))
      // Deterministic intra-dish order: loadMealsByDate selects without an
      // ORDER BY, so this is not inherited and must be stated here.
      .orderBy(
        asc(mealItems.mealItemOrder),
        asc(mealItems.createdAt),
        asc(mealItems.id)
      );

    let dishes: ReturnType<
      typeof resolveRelogDishes<(typeof sourceRows)[number]>
    >;
    try {
      dishes = resolveRelogDishes(parsed.items, sourceRows);
    } catch (error) {
      if (error instanceof RelogResolutionError) {
        throw Errors.validationFailed(error.message);
      }
      throw error;
    }

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
    const mealNutrition = sumDisplayedNutrition(copies.map((c) => c.nutrition));
    // Same derivation the optimistic client card uses — one source of truth.
    const rawInput = buildRelogRawInput(dishes.map((d) => d.name));
    // A composed meal is no more confident than its least confident part.
    const confidenceOverall = weakestConfidence(
      sourceMeals.map((m) => m.confidenceOverall)
    );

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
}

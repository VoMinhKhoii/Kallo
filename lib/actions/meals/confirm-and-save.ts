'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildPersistedIngredient,
  buildPersistedMeal,
  buildPersistedMealItemGroup,
  inferMealSlot,
  nutritionValuesToRow,
} from '@/lib/actions/logging/persisted-meal';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
} from '@/lib/ai/pipeline/assemble/goal-adjustment';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { PipelineResult } from '@/lib/ai/types/result';
import { confirmMealSchema } from '@/lib/api/contracts/meals';
import { Errors } from '@/lib/core/errors/catalog';
import type { CheatSliderLevels } from '@/lib/core/types/cheat';
import { goalEnumSchema } from '@/lib/domain/onboarding/schemas';
import type { Goal } from '@/lib/domain/onboarding/types';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import {
  mealItems,
  meals,
  pendingAnalyses,
  unmatchedIngredients,
} from '@/lib/infra/db/schema';
import { assertCheatConfirmAllowed, confirmCheatMeal } from './confirm-cheat';
import { insertDefaultCircleShare } from './insert-default-share';
import type { ConfirmMealResponse, PersistedMealItemGroup } from './types';

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

// `confirmMealSchema` (this action's full input) lives in the meals contract so
// the `/api/v1/meals/confirm` route and the mobile client validate against the
// same object; imported here since this `'use server'` module may only export
// async functions. Same arrangement as `updateMealSchema` in mutate-meal.ts.

const profileNutritionSettingsSchema = z
  .object({
    goal: goalEnumSchema.nullish(),
    aggression: z
      .preprocess(
        (value) => (value === '' ? null : value),
        z.union([z.coerce.number().min(0).max(0.8), z.null()]).optional()
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.goal !== 'maintaining' &&
      data.goal != null &&
      data.aggression == null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['aggression'],
        message: 'Aggression is required for cutting and bulking goals.',
      });
    }
  });

// ---------------------------------------------------------------------------
// C1: Confirm and Save Meal
// ---------------------------------------------------------------------------

export async function confirmAndSaveMealAction(input: {
  analysisId: string;
  mealId?: string;
  edits?: {
    mealItemOrder: number;
    ingredientIndex?: number;
    newGrams: number;
  }[];
  levels?: CheatSliderLevels;
}): Promise<ConfirmMealResponse> {
  const parsed = confirmMealSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();
  // Premium (cheat_meal) — resolved and enforced BEFORE the transaction opens
  // (no entitlement reads inside an open tx; pool max is 2). No-op unless the
  // pending row is a cheat one. See `assertCheatConfirmAllowed`.
  await assertCheatConfirmAllowed(
    user.id,
    profile.createdAt,
    parsed.analysisId
  );

  return await db.transaction(async (tx) => {
    // Atomically consume the pending analysis (prevents duplicate confirms)
    const [pending] = await tx
      .delete(pendingAnalyses)
      .where(
        and(
          eq(pendingAnalyses.id, parsed.analysisId),
          eq(pendingAnalyses.userId, user.id)
        )
      )
      .returning();

    if (!pending) {
      throw Errors.validationFailed(
        'Phân tích không tồn tại hoặc đã được lưu.'
      );
    }

    // Cheat-meal branch: recompute nutrition from the staged slider spec + the
    // user's chosen levels (server-authoritative), insert a single meal row
    // with zero meal_items, and store the spec/levels for re-edit.
    if (pending.entryMode === 'cheat') {
      return confirmCheatMeal({
        tx,
        userId: user.id,
        pending,
        mealId: parsed.mealId,
        levels: parsed.levels ?? {},
      });
    }

    const pipelineResult = pending.pipelineResult as PipelineResult;

    // Apply user edits (quantity overrides) if provided
    if (parsed.edits?.length) {
      // Scale an ingredient's bounded nutrition ranges in place.
      const scaleIngredient = (
        ingredient: (typeof pipelineResult.mealItems)[number]['ingredients'][number],
        ratio: number
      ) => {
        for (const key of NUTRITION_KEYS) {
          const bounded = ingredient.boundedNutrition[key];
          if (bounded) {
            ingredient.boundedNutrition[key] = {
              low: bounded.low * ratio,
              mid: bounded.mid * ratio,
              high: bounded.high * ratio,
            };
          }
        }
      };

      for (const edit of parsed.edits) {
        const mealItem = pipelineResult.mealItems[edit.mealItemOrder];
        if (!mealItem) continue;

        // Whole-dish edit: newGrams is the new total weight, so scale every
        // ingredient by the dish-level ratio.
        if (edit.ingredientIndex === undefined) {
          const totalGrams = mealItem.ingredients.reduce(
            (sum, ing) => sum + ing.estimatedGrams,
            0
          );
          // A dish with unknown/zero base weight can't be gram-scaled: there's
          // no ratio to apply. Record the new grams but leave nutrition intact
          // rather than multiplying it to zero (which silently nuked relogged
          // items whose source row had null `estimated_grams`).
          if (totalGrams <= 0) {
            for (const ingredient of mealItem.ingredients) {
              ingredient.estimatedGrams = edit.newGrams;
            }
            continue;
          }
          const ratio = edit.newGrams / totalGrams;
          for (const ingredient of mealItem.ingredients) {
            ingredient.estimatedGrams *= ratio;
            scaleIngredient(ingredient, ratio);
          }
          continue;
        }

        const ingredient = mealItem.ingredients[edit.ingredientIndex];
        if (!ingredient) continue;

        // Same guard for a single-ingredient edit: no base weight ⇒ no ratio,
        // so set the grams but keep the authoritative nutrition.
        if (ingredient.estimatedGrams <= 0) {
          ingredient.estimatedGrams = edit.newGrams;
          continue;
        }
        const ratio = edit.newGrams / ingredient.estimatedGrams;
        ingredient.estimatedGrams = edit.newGrams;
        scaleIngredient(ingredient, ratio);
      }
    }

    const loggedAt = pending.loggedAt;
    const mealSlot = pipelineResult.mealSlot ?? inferMealSlot(loggedAt);
    const profileNutritionSettings = profileNutritionSettingsSchema.parse({
      goal: profile.goal,
      aggression: profile.aggression,
    });
    const goal: Goal = profileNutritionSettings.goal ?? 'maintaining';
    let aggression = 0;
    if (goal !== 'maintaining') {
      const validatedAggression = profileNutritionSettings.aggression;
      if (validatedAggression == null) {
        throw Errors.validationFailed(
          'Hồ sơ mục tiêu dinh dưỡng không hợp lệ.'
        );
      }
      aggression = validatedAggression;
    }

    const persistedMealItems = pipelineResult.mealItems.map((mealItem) => {
      const ingredients = mealItem.ingredients.map((ingredient) => {
        const displayedNutrition = goalAdjustNutrition(
          ingredient.boundedNutrition,
          goal,
          aggression
        );

        return {
          ...ingredient,
          displayedNutrition,
        };
      });

      const boundedNutrition = sumBoundedNutrition(
        ingredients.map((ingredient) => ingredient.boundedNutrition)
      );
      const displayedNutrition = goalAdjustNutrition(
        boundedNutrition,
        goal,
        aggression
      );

      return {
        ...mealItem,
        ingredients,
        boundedNutrition,
        displayedNutrition,
      };
    });

    const allIngredients = persistedMealItems.flatMap((mi) => mi.ingredients);
    const mealBounded = sumBoundedNutrition(
      allIngredients.map((ingredient) => ingredient.boundedNutrition)
    );
    const mealDisplayed = goalAdjustNutrition(mealBounded, goal, aggression);

    // Insert meal
    const [meal] = await tx
      .insert(meals)
      .values({
        ...(parsed.mealId ? { id: parsed.mealId } : {}),
        userId: user.id,
        rawInput: pending.rawInput,
        mealSlot,
        confidenceOverall: pipelineResult.confidenceOverall,
        loggedAt,
        ...nutritionValuesToRow(mealDisplayed),
      })
      .returning({ id: meals.id });

    // Share to circle by default when the profile-level opt-out is disabled.
    // The AFTER INSERT trigger fans out the meal_shared circle event. The user
    // can still opt this meal back out via the per-meal toggle, while
    // onConflictDoNothing preserves a prior explicit choice on the
    // re-confirm/edit path (existing meal id). The helper reads the preference
    // inside the transaction — the profile row loaded at auth time could be
    // stale if the user flips the toggle mid-analysis.
    const share = await insertDefaultCircleShare(tx, {
      mealId: meal.id,
      actorId: user.id,
    });

    // Pre-generate a stable id for each ingredient row so the inserted rows and
    // the saved-meal payload returned below share ids by construction — no
    // dependence on RETURNING row order. (mealItems.id defaults to
    // gen_random_uuid(); an explicit id simply overrides that default.)
    const itemGroups = persistedMealItems.map((mealItem, order) => ({
      name: mealItem.name,
      order,
      displayedNutrition: mealItem.displayedNutrition,
      ingredients: mealItem.ingredients.map((ing) => ({
        id: randomUUID(),
        ing,
      })),
    }));

    // Insert meal items (ingredients grouped by parent dish)
    const itemRows = itemGroups.flatMap((group) =>
      group.ingredients.map(({ id, ing }) => ({
        id,
        mealId: meal.id,
        ingredientName: ing.ingredientName,
        mealItemName: group.name,
        mealItemOrder: group.order,
        foodCompositionId: ing.foodCompositionId,
        estimatedGrams: ing.estimatedGrams,
        userFacingUnit: ing.userFacingUnit,
        cookingMethod: ing.cookingMethod,
        matchConfidence: ing.matchConfidence,
        ...nutritionValuesToRow(ing.displayedNutrition),
      }))
    );

    if (itemRows.length > 0) {
      await tx.insert(mealItems).values(itemRows);
    }

    // Await all unmatched ingredient updates within the transaction
    if (pipelineResult.unmatchedIngredients.length > 0) {
      await Promise.all(
        pipelineResult.unmatchedIngredients.map((unmatched) =>
          tx
            .update(unmatchedIngredients)
            .set({ mealId: meal.id })
            .where(
              and(
                eq(unmatchedIngredients.userId, user.id),
                eq(unmatchedIngredients.queryText, unmatched.ingredientName),
                eq(unmatchedIngredients.mealContext, unmatched.mealContext),
                isNull(unmatchedIngredients.mealId)
              )
            )
        )
      );
    }

    // Rebuild the saved meal in the exact shape loadMealsByDate returns, from
    // data already computed in this transaction (reusing the same pre-generated
    // ingredient ids). The client reconciles its optimistic card straight to
    // these authoritative values from the confirm response — no follow-up day
    // refetch (and its round-trip) required.
    const mealItemGroups: PersistedMealItemGroup[] = itemGroups.map((group) =>
      buildPersistedMealItemGroup(
        group.name,
        group.order,
        group.ingredients.map(({ id, ing }) =>
          buildPersistedIngredient({
            id,
            ingredientName: ing.ingredientName,
            foodCompositionId: ing.foodCompositionId,
            estimatedGrams: ing.estimatedGrams,
            userFacingUnit: ing.userFacingUnit,
            cookingMethod: ing.cookingMethod,
            matchConfidence: ing.matchConfidence,
            nutrition: ing.displayedNutrition,
          })
        )
      )
    );

    const savedMeal = buildPersistedMeal({
      id: meal.id,
      rawInput: pending.rawInput,
      mealSlot,
      confidenceOverall: pipelineResult.confidenceOverall,
      loggedAt: loggedAt.toISOString(),
      nutrition: mealDisplayed,
      mealItemGroups,
      entryMode: 'precise',
      alcoholG: null,
      cheatSliders: null,
      // Shared to circle by default (see the meal_shares insert above).
      share,
    });

    // `mealId` kept for backward compatibility (e.g. the mobile confirm route);
    // `meal` is the authoritative payload the web client reconciles against.
    return { mealId: meal.id, meal: savedMeal };
  });
}

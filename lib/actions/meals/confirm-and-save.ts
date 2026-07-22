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
} from '@/lib/actions/persisted-meal';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
} from '@/lib/ai/pipeline/goal-adjustment';
import type { PipelineResult } from '@/lib/ai/types';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  mealItems,
  meals,
  pendingAnalyses,
  unmatchedIngredients,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { goalEnumSchema } from '@/lib/onboarding/schemas';
import type { Goal } from '@/lib/onboarding/types';
import type { CheatSliderLevels } from '@/lib/types/cheat';
import { confirmCheatMeal } from './confirm-cheat';
import { insertDefaultCircleShare } from './insert-default-share';
import type { ConfirmMealResponse, PersistedMealItemGroup } from './types';

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const confirmAndSaveSchema = z.object({
  analysisId: z.string().uuid('analysisId phải là UUID hợp lệ.'),
  // Client-generated id so the optimistic card and the persisted row share a
  // stable React key (avoids a remount/re-fade once the refetch lands).
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  // Quantity overrides. Omitting `ingredientIndex` scales the whole dish
  // (every ingredient) so `newGrams` is the new total cooked weight.
  edits: z
    .array(
      z.object({
        mealItemOrder: z.number().int().min(0),
        ingredientIndex: z.number().int().min(0).optional(),
        newGrams: z.number().positive().finite().max(100_000),
      })
    )
    .max(50)
    .optional(),
  // Cheat-meal: the user's chosen slider positions (0–10 per axis). The server
  // recomputes nutrition from the staged spec + these levels — it never trusts
  // client-sent nutrition numbers.
  levels: z
    .partialRecord(
      z.enum(['protein', 'carbs', 'fat', 'drinks']),
      z.number().min(0).max(10)
    )
    .optional(),
});
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
  const parsed = confirmAndSaveSchema.parse(input);
  const { user, profile } = await requireAuthAndProfile();

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
          const ratio = totalGrams > 0 ? edit.newGrams / totalGrams : 0;
          for (const ingredient of mealItem.ingredients) {
            ingredient.estimatedGrams *= ratio;
            scaleIngredient(ingredient, ratio);
          }
          continue;
        }

        const ingredient = mealItem.ingredients[edit.ingredientIndex];
        if (!ingredient) continue;

        const ratio =
          ingredient.estimatedGrams > 0
            ? edit.newGrams / ingredient.estimatedGrams
            : 0;
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
    // re-confirm/edit path (existing meal id).
    const shareRow = await insertDefaultCircleShare(tx, {
      mealId: meal.id,
      actorId: user.id,
      autoShare: profile.autoShareToCircle,
    });
    const share = shareRow
      ? { shareId: shareRow.id, visibility: shareRow.visibility }
      : null;

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

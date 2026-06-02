'use server';

import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import { toParsedMeal } from '@/lib/ai/mappers';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from '@/lib/ai/pipeline/goal-adjustment';
import type { NutritionValues, PipelineResult } from '@/lib/ai/types';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcDayRangeForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import {
  mealItems,
  mealShares,
  meals,
  pendingAnalyses,
  unmatchedIngredients,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { goalEnumSchema } from '@/lib/onboarding/schemas';
import type { Goal } from '@/lib/onboarding/types';
import { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';

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
});

const loadMealsByDateSchema = z.object({
  date: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});
type LoadMealsByDateInput = z.infer<typeof loadMealsByDateSchema>;

const deleteMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
});

const loadMealDatesSchema = z.object({
  timezoneOffset: timezoneOffsetSchema,
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Persist a single numeric value per nutrient on meals and meal_items.
 */
function nutritionValuesToRow(
  nutrition: NutritionValues
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of NUTRITION_KEYS) {
    row[key] = nutrition[key];
  }
  return row;
}

/** Infer meal slot from time of day as fallback */
function inferMealSlot(date: Date): string {
  const hour = date.getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}

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
}) {
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

    // Insert meal items (ingredients grouped by parent dish)
    const itemRows = persistedMealItems.flatMap((mealItem, order) =>
      mealItem.ingredients.map((ing) => ({
        mealId: meal.id,
        ingredientName: ing.ingredientName,
        mealItemName: mealItem.name,
        mealItemOrder: order,
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

    return { mealId: meal.id };
  });
}

// ---------------------------------------------------------------------------
// C2: Load Meals by Date
// ---------------------------------------------------------------------------

/** Persisted meal returned to client */
export interface PersistedMeal {
  id: string;
  rawInput: string;
  mealSlot: string | null;
  confidenceOverall: string | null;
  loggedAt: string;
  nutrition: NutritionValues;
  mealItemGroups: PersistedMealItemGroup[];
  /** Circle-share state, or null if the meal was never shared. `shareId` is the
   *  meal_shares row id used to key the shareable Macro Card. Lets the card seed
   *  the share toggle from real server state instead of always "not shared". */
  share: { shareId: string; visibility: string } | null;
}

export interface PersistedMealItemGroup {
  name: string;
  order: number;
  ingredients: PersistedIngredient[];
  nutrition: NutritionValues;
}

export interface PersistedIngredient {
  id: string;
  ingredientName: string;
  foodCompositionId: string | null;
  estimatedGrams: number | null;
  userFacingUnit: string | null;
  cookingMethod: string | null;
  matchConfidence: number | null;
  nutrition: NutritionValues;
}

export interface PendingMealConfirmation {
  id: string;
  rawInput: string;
  loggedAt: string;
  parsedMeal: ReturnType<typeof toParsedMeal>;
}

export interface LoggingDayData {
  persistedMeals: PersistedMeal[];
  pendingConfirmations: PendingMealConfirmation[];
}

export async function loadMealsByDate(input: {
  date: string;
  timezoneOffset: number;
}): Promise<PersistedMeal[]> {
  const parsed = loadMealsByDateSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return loadMealsByDateForUser(user.id, parsed);
}

async function loadMealsByDateForUser(
  userId: string,
  parsed: LoadMealsByDateInput
): Promise<PersistedMeal[]> {
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    parsed.date,
    parsed.timezoneOffset
  );

  // Fetch meals in date range
  const mealRows = await db
    .select()
    .from(meals)
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, dayStart),
        lt(meals.loggedAt, dayEnd)
      )
    )
    .orderBy(desc(meals.loggedAt));

  if (mealRows.length === 0) return [];

  // Fetch all meal items for these meals in one query
  const mealIds = mealRows.map((m) => m.id);
  const itemRows = await db
    .select()
    .from(mealItems)
    .where(inArray(mealItems.mealId, mealIds));

  // Group items by mealId
  const itemsByMealId = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const existing = itemsByMealId.get(item.mealId) ?? [];
    existing.push(item);
    itemsByMealId.set(item.mealId, existing);
  }

  // Fetch each meal's share row (at most one per meal) so the card can seed its
  // share toggle from real state instead of defaulting to "not shared".
  const shareRows = await db
    .select({
      mealId: mealShares.mealId,
      id: mealShares.id,
      visibility: mealShares.visibility,
    })
    .from(mealShares)
    .where(inArray(mealShares.mealId, mealIds));
  const shareByMealId = new Map(shareRows.map((s) => [s.mealId, s]));

  return mealRows.map((meal) => {
    const items = itemsByMealId.get(meal.id) ?? [];

    // Reconstruct meal item groups from flat ingredients
    const groupMap = new Map<string, PersistedMealItemGroup>();
    for (const item of items) {
      const key = `${item.mealItemOrder}:${item.mealItemName}`;
      let group = groupMap.get(key);
      if (!group) {
        group = {
          name: item.mealItemName,
          order: item.mealItemOrder,
          ingredients: [],
          nutrition: {} as NutritionValues,
        };
        groupMap.set(key, group);
      }
      group.ingredients.push({
        id: item.id,
        ingredientName: item.ingredientName,
        foodCompositionId: item.foodCompositionId,
        estimatedGrams: item.estimatedGrams,
        userFacingUnit: item.userFacingUnit,
        cookingMethod: item.cookingMethod,
        matchConfidence: item.matchConfidence,
        nutrition: extractNutritionValues(item),
      });
    }

    // Sort groups by order, compute group-level nutrition
    const groups = Array.from(groupMap.values()).sort(
      (a, b) => a.order - b.order
    );
    for (const group of groups) {
      group.nutrition = sumDisplayedNutrition(
        group.ingredients.map((ingredient) => ingredient.nutrition)
      );
    }

    const share = shareByMealId.get(meal.id);

    return {
      id: meal.id,
      rawInput: meal.rawInput,
      mealSlot: meal.mealSlot,
      confidenceOverall: meal.confidenceOverall,
      loggedAt: meal.loggedAt.toISOString(),
      nutrition: extractNutritionValues(meal),
      mealItemGroups: groups,
      share: share ? { shareId: share.id, visibility: share.visibility } : null,
    };
  });
}

export async function loadPendingAnalysesByDate(input: {
  date: string;
  timezoneOffset: number;
}): Promise<PendingMealConfirmation[]> {
  const parsed = loadMealsByDateSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return loadPendingAnalysesByDateForUser(user.id, parsed);
}

async function loadPendingAnalysesByDateForUser(
  userId: string,
  parsed: LoadMealsByDateInput
): Promise<PendingMealConfirmation[]> {
  const { dayStart, dayEnd } = getUtcDayRangeForLocalDate(
    parsed.date,
    parsed.timezoneOffset
  );

  const rows = await db
    .select()
    .from(pendingAnalyses)
    .where(
      and(
        eq(pendingAnalyses.userId, userId),
        gte(pendingAnalyses.loggedAt, dayStart),
        lt(pendingAnalyses.loggedAt, dayEnd)
      )
    )
    .orderBy(desc(pendingAnalyses.loggedAt));

  return rows.flatMap((row) => {
    // Defensive: a row whose stored pipelineResult predates the current shape
    // (legacy/malformed) must not throw and 500 the entire day load via the
    // Promise.all in loadLoggingDay. toParsedMeal walks several fields
    // (mealItems, each item's ingredients, displayedNutrition), so guard the
    // whole conversion rather than one field — any malformed shape is skipped.
    // Skipping is safe: such a row is un-confirmable anyway since confirm reads
    // the same pipelineResult.
    try {
      return [
        {
          id: row.id,
          rawInput: row.rawInput,
          loggedAt: row.loggedAt.toISOString(),
          parsedMeal: toParsedMeal(row.pipelineResult as PipelineResult),
        },
      ];
    } catch (error) {
      console.error(
        '[loadPendingAnalyses] Skipping pending analysis with malformed pipelineResult',
        { id: row.id, error }
      );
      return [];
    }
  });
}

export async function loadLoggingDay(input: {
  date: string;
  timezoneOffset: number;
}): Promise<LoggingDayData> {
  const parsed = loadMealsByDateSchema.parse(input);
  const { user } = await requireAuthAndProfile();
  const [persistedMeals, pendingConfirmations] = await Promise.all([
    loadMealsByDateForUser(user.id, parsed),
    loadPendingAnalysesByDateForUser(user.id, parsed),
  ]);

  return { persistedMeals, pendingConfirmations };
}

/** Extract flat NutritionValues from a DB row with numeric columns */
function extractNutritionValues(row: Record<string, unknown>): NutritionValues {
  const result: NutritionValues = {
    caloriesKcal: null,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
    fiberG: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMcg: null,
    manganeseMg: null,
    betaCaroteneMcg: null,
    vitaminAMcg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    vitaminCMg: null,
    vitaminB1Mg: null,
    vitaminB2Mg: null,
    vitaminPpMg: null,
    vitaminB5Mg: null,
    vitaminB6Mg: null,
    vitaminB9Mcg: null,
    vitaminB12Mcg: null,
    vitaminHMcg: null,
  };
  for (const key of NUTRITION_KEYS) {
    const val = row[key];
    if (typeof val === 'number') {
      result[key] = Number.isFinite(val) ? val : null;
      continue;
    }

    if (typeof val === 'string') {
      const parsed = Number(val);
      result[key] = Number.isFinite(parsed) ? parsed : null;
      continue;
    }

    result[key] = null;
  }
  return result;
}

// ---------------------------------------------------------------------------
// C3: Delete Meal
// ---------------------------------------------------------------------------

export async function deleteMealAction(input: { mealId: string }) {
  const parsed = deleteMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Defense in depth: WHERE user_id check beyond RLS
  const [deleted] = await db
    .delete(meals)
    .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
    .returning({ id: meals.id });

  if (!deleted) {
    throw Errors.validationFailed(
      'Bữa ăn không tồn tại hoặc không thuộc về bạn.'
    );
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// C9: Load distinct meal dates for timeline sidebar
// ---------------------------------------------------------------------------

export async function loadMealDates(input: {
  timezoneOffset: number;
}): Promise<string[]> {
  const parsed = loadMealDatesSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Use offset (opposite sign from JS getTimezoneOffset) to compute local date
  // JS getTimezoneOffset(): UTC+7 = -420, UTC-5 = +300
  // To convert UTC → local: UTC + offsetMins = local
  // Use sql.raw() to inline the integer so DISTINCT ON and ORDER BY produce
  // the same SQL text (Drizzle re-parameterizes the same sql`` object which
  // causes PostgreSQL 42P10: "DISTINCT ON expressions must match ORDER BY").
  const offsetMins = -parsed.timezoneOffset;
  const mealDateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;
  const pendingDateExpr = sql<string>`DATE(${pendingAnalyses.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;

  const [mealRows, pendingRows] = await Promise.all([
    db
      .selectDistinctOn([mealDateExpr], {
        date: mealDateExpr.as('date'),
      })
      .from(meals)
      .where(eq(meals.userId, user.id))
      .orderBy(desc(mealDateExpr)),
    db
      .selectDistinctOn([pendingDateExpr], {
        date: pendingDateExpr.as('date'),
      })
      .from(pendingAnalyses)
      .where(eq(pendingAnalyses.userId, user.id))
      .orderBy(desc(pendingDateExpr)),
  ]);

  return Array.from(
    new Set([
      ...mealRows.map((row) => row.date),
      ...pendingRows.map((row) => row.date),
    ])
  ).sort((a, b) => b.localeCompare(a));
}

'use server';

import { and, desc, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type {
  BoundedEstimate,
  BoundedNutrition,
  PipelineResult,
} from '@/lib/ai/types';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  mealItems,
  meals,
  pendingAnalyses,
  unmatchedIngredients,
} from '@/lib/db/schema';
import { Errors } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Zod schemas for input validation
// ---------------------------------------------------------------------------

const confirmAndSaveSchema = z.object({
  analysisId: z.string().uuid('analysisId phải là UUID hợp lệ.'),
  edits: z
    .array(
      z.object({
        mealItemOrder: z.number().int().min(0),
        ingredientIndex: z.number().int().min(0),
        newGrams: z.number().positive(),
      })
    )
    .optional(),
});

const loadMealsByDateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD.'),
  timezoneOffset: z.number().int().min(-840).max(720),
});

const deleteMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
});

const loadMealDatesSchema = z.object({
  timezoneOffset: z.number().int().min(-840).max(720),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract bounded nutrition JSONB values for DB insertion */
function boundedNutritionToRow(
  bounded: BoundedNutrition
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of NUTRITION_KEYS) {
    row[key] = bounded[key];
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
  edits?: {
    mealItemOrder: number;
    ingredientIndex: number;
    newGrams: number;
  }[];
}) {
  const parsed = confirmAndSaveSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    // Atomically consume the pending analysis (prevents duplicate confirms)
    const [pending] = await tx
      .delete(pendingAnalyses)
      .where(
        and(
          eq(pendingAnalyses.id, parsed.analysisId),
          eq(pendingAnalyses.userId, user.id),
          gt(pendingAnalyses.expiresAt, sql`now()`)
        )
      )
      .returning();

    if (!pending) {
      throw Errors.validationFailed(
        'Phân tích không tồn tại, đã hết hạn, hoặc đã được lưu.'
      );
    }

    const pipelineResult = pending.pipelineResult as PipelineResult;

    // Apply user edits (quantity overrides) if provided
    if (parsed.edits?.length) {
      for (const edit of parsed.edits) {
        const mealItem = pipelineResult.mealItems[edit.mealItemOrder];
        if (!mealItem) continue;
        const ingredient = mealItem.ingredients[edit.ingredientIndex];
        if (!ingredient) continue;

        const ratio =
          ingredient.estimatedGrams > 0
            ? edit.newGrams / ingredient.estimatedGrams
            : 0;
        ingredient.estimatedGrams = edit.newGrams;

        // Scale bounded nutrition proportionally
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
      }
    }

    const now = pending.createdAt;
    const mealSlot = pipelineResult.mealSlot ?? inferMealSlot(now);

    // Recompute meal-level bounded nutrition from (possibly edited) ingredients
    const allIngredients = pipelineResult.mealItems.flatMap(
      (mi) => mi.ingredients
    );
    const mealBounded = sumBounded(
      allIngredients.map((i) => i.boundedNutrition)
    );

    // Insert meal
    const [meal] = await tx
      .insert(meals)
      .values({
        userId: user.id,
        rawInput: pending.rawInput,
        mealSlot,
        confidenceOverall: pipelineResult.confidenceOverall,
        loggedAt: now,
        ...boundedNutritionToRow(mealBounded),
      })
      .returning({ id: meals.id });

    // Insert meal items (ingredients grouped by parent dish)
    const itemRows = pipelineResult.mealItems.flatMap((mealItem, order) =>
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
        ...boundedNutritionToRow(ing.boundedNutrition),
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
                eq(unmatchedIngredients.queryText, unmatched.ingredientName),
                eq(unmatchedIngredients.mealContext, unmatched.mealContext),
                isNull(unmatchedIngredients.mealId)
              )
            )
            .catch((err: unknown) =>
              console.error('Failed to attach mealId to unmatched:', err)
            )
        )
      );
    }

    return { mealId: meal.id };
  });
}

/** Sum bounded nutrition across multiple items */
function sumBounded(items: BoundedNutrition[]): BoundedNutrition {
  const result = {} as Record<string, BoundedEstimate | null>;
  for (const key of NUTRITION_KEYS) {
    let low = 0;
    let mid = 0;
    let high = 0;
    let hasAny = false;
    for (const item of items) {
      const val = item[key];
      if (val !== null) {
        low += val.low;
        mid += val.mid;
        high += val.high;
        hasAny = true;
      }
    }
    result[key] = hasAny ? { low, mid, high } : null;
  }
  return result as unknown as BoundedNutrition;
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
  boundedNutrition: BoundedNutrition;
  mealItemGroups: PersistedMealItemGroup[];
}

export interface PersistedMealItemGroup {
  name: string;
  order: number;
  ingredients: PersistedIngredient[];
  boundedNutrition: BoundedNutrition;
}

export interface PersistedIngredient {
  id: string;
  ingredientName: string;
  foodCompositionId: string | null;
  estimatedGrams: number | null;
  userFacingUnit: string | null;
  cookingMethod: string | null;
  matchConfidence: number | null;
  boundedNutrition: BoundedNutrition;
}

export async function loadMealsByDate(input: {
  date: string;
  timezoneOffset: number;
}): Promise<PersistedMeal[]> {
  const parsed = loadMealsByDateSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  // Compute UTC range for the given date in the user's timezone
  // timezoneOffset is in minutes (e.g. UTC+7 = -420)
  const offsetMs = parsed.timezoneOffset * 60 * 1000;
  const dayStart = new Date(`${parsed.date}T00:00:00.000Z`);
  dayStart.setTime(dayStart.getTime() + offsetMs);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Fetch meals in date range
  const mealRows = await db
    .select()
    .from(meals)
    .where(
      and(
        eq(meals.userId, user.id),
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
    .where(
      sql`${mealItems.mealId} IN (${sql.join(
        mealIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  // Group items by mealId
  const itemsByMealId = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const existing = itemsByMealId.get(item.mealId) ?? [];
    existing.push(item);
    itemsByMealId.set(item.mealId, existing);
  }

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
          boundedNutrition: {} as BoundedNutrition,
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
        boundedNutrition: extractBoundedNutrition(item),
      });
    }

    // Sort groups by order, compute group-level bounded nutrition
    const groups = Array.from(groupMap.values()).sort(
      (a, b) => a.order - b.order
    );
    for (const group of groups) {
      group.boundedNutrition = sumBounded(
        group.ingredients.map((i) => i.boundedNutrition)
      );
    }

    return {
      id: meal.id,
      rawInput: meal.rawInput,
      mealSlot: meal.mealSlot,
      confidenceOverall: meal.confidenceOverall,
      loggedAt: meal.loggedAt.toISOString(),
      boundedNutrition: extractBoundedNutrition(meal),
      mealItemGroups: groups,
    };
  });
}

/** Extract BoundedNutrition from a DB row with JSONB columns */
function extractBoundedNutrition(
  row: Record<string, unknown>
): BoundedNutrition {
  const result = {} as Record<string, BoundedEstimate | null>;
  for (const key of NUTRITION_KEYS) {
    const val = row[key];
    if (
      val &&
      typeof val === 'object' &&
      'mid' in (val as Record<string, unknown>)
    ) {
      result[key] = val as BoundedEstimate;
    } else {
      result[key] = null;
    }
  }
  return result as unknown as BoundedNutrition;
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
  const dateExpr = sql<string>`DATE(${meals.loggedAt} + (${sql.raw(String(offsetMins))}::integer * INTERVAL '1 minute'))`;

  const rows = await db
    .selectDistinctOn([dateExpr], {
      date: dateExpr.as('date'),
    })
    .from(meals)
    .where(eq(meals.userId, user.id))
    .orderBy(desc(dateExpr));

  return rows.map((r) => r.date);
}

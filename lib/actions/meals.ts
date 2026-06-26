'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildMealItemGroupsFromRows,
  buildPersistedIngredient,
  buildPersistedMeal,
  buildPersistedMealItemGroup,
  extractNutritionValues,
  inferMealSlot,
  nutritionValuesToRow,
} from '@/lib/actions/persisted-meal';
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import { toParsedMeal } from '@/lib/ai/mappers';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
  sumDisplayedNutrition,
} from '@/lib/ai/pipeline/goal-adjustment';
import type { NutritionValues, PipelineResult } from '@/lib/ai/types';
import { requireAuthAndProfile } from '@/lib/auth';
import { groupOccasions } from '@/lib/cheat/occasion-grouping';
import {
  resolveSliderNutrition,
  withLevelsAsDefaults,
} from '@/lib/cheat/slider-nutrition';
import {
  getUtcDayRangeForLocalDate,
  getUtcInstantForLocalDate,
} from '@/lib/date/local-day';
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
import type {
  CheatSliderLevels,
  CheatSliderSpec,
  CheatSlidersPersisted,
} from '@/lib/types/cheat';
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

const loadMealsByDateSchema = z.object({
  date: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});
type LoadMealsByDateInput = z.infer<typeof loadMealsByDateSchema>;

const deleteMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
});

const updateMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
  // Per-stored-item gram override. `id` is the meal_items row id (the same id
  // the card renders), so the client never needs to track positional order.
  edits: z
    .array(
      z.object({
        id: z.string().uuid(),
        newGrams: z.number().positive().finite().max(100_000),
      })
    )
    .max(100)
    .optional(),
  // Stored item rows to drop entirely (per-row "remove").
  removeIds: z.array(z.string().uuid()).max(100).optional(),
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

/** All nutrient keys null — base for building a sparse NutritionValues. */
const EMPTY_NUTRITION = Object.fromEntries(
  NUTRITION_KEYS.map((key) => [key, null])
) as unknown as NutritionValues;

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
      const { spec } = pending.pipelineResult as {
        entryMode: 'cheat';
        spec: CheatSliderSpec;
      };
      const levels: CheatSliderLevels = parsed.levels ?? {};
      const resolved = resolveSliderNutrition(spec, levels);

      const loggedAt = pending.loggedAt;
      const mealSlot = spec.mealSlot ?? inferMealSlot(loggedAt);
      const persisted: CheatSlidersPersisted = { spec, levels };

      const [meal] = await tx
        .insert(meals)
        .values({
          ...(parsed.mealId ? { id: parsed.mealId } : {}),
          userId: user.id,
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

      // Rebuild the saved cheat meal in the shape loadMealsByDate returns, so
      // the client reconciles its optimistic card from the confirm response
      // (same id → in-place overwrite, no day refetch) — mirroring the precise
      // path below. Cheat meals carry zero meal_items.
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
        share: null,
      });

      return { mealId: meal.id, meal: savedMeal };
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
      // A freshly-saved meal is never shared yet.
      share: null,
    });

    // `mealId` kept for backward compatibility (e.g. the mobile confirm route);
    // `meal` is the authoritative payload the web client reconciles against.
    return { mealId: meal.id, meal: savedMeal };
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
  /** 'precise' (default pipeline) or 'cheat' (slider estimate). */
  entryMode: 'precise' | 'cheat';
  /** Cheat-only: ethanol grams folded into the calorie total. */
  alcoholG: number | null;
  /** Cheat-only: slider spec + chosen levels, for re-edit/repeat. */
  cheatSliders: CheatSlidersPersisted | null;
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
  /** Set for precise entries. Absent for cheat entries (which carry cheatSpec). */
  parsedMeal?: ReturnType<typeof toParsedMeal>;
  /** Set for cheat entries: the staged slider spec the user confirms against. */
  cheatSpec?: CheatSliderSpec;
}

export interface LoggingDayData {
  persistedMeals: PersistedMeal[];
  pendingConfirmations: PendingMealConfirmation[];
}

/**
 * Return shape of `confirmAndSaveMealAction`. `mealId` is kept for backward
 * compatibility (the mobile `POST /api/v1/meals/confirm` route echoes it);
 * `meal` is the authoritative saved meal the web client reconciles against
 * without a follow-up day refetch. Re-exported via lib/api/contracts/meals.ts.
 */
export interface ConfirmMealResponse {
  mealId: string;
  meal: PersistedMeal;
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

    const mealItemGroups = buildMealItemGroupsFromRows(
      items.map((item) => ({
        ...item,
        nutrition: extractNutritionValues(item),
      }))
    );

    const share = shareByMealId.get(meal.id);

    return buildPersistedMeal({
      id: meal.id,
      rawInput: meal.rawInput,
      mealSlot: meal.mealSlot,
      confidenceOverall: meal.confidenceOverall,
      loggedAt: meal.loggedAt.toISOString(),
      nutrition: extractNutritionValues(meal),
      mealItemGroups,
      entryMode: meal.entryMode === 'cheat' ? 'cheat' : 'precise',
      alcoholG: meal.alcoholG ?? null,
      cheatSliders: (meal.cheatSliders as CheatSlidersPersisted | null) ?? null,
      share: share ? { shareId: share.id, visibility: share.visibility } : null,
    });
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

  return rows.flatMap<PendingMealConfirmation>((row) => {
    // Defensive: a row whose stored pipelineResult predates the current shape
    // (legacy/malformed) must not throw and 500 the entire day load via the
    // Promise.all in loadLoggingDay. Guard the whole conversion — any malformed
    // shape is skipped (such a row is un-confirmable anyway, since confirm reads
    // the same pipelineResult).
    try {
      const base = {
        id: row.id,
        rawInput: row.rawInput,
        loggedAt: row.loggedAt.toISOString(),
      };
      // Cheat rows stage a slider spec, not a decomposition PipelineResult, so
      // toParsedMeal (which reads .mealItems) can't apply. Branch on entryMode,
      // mirroring confirmAndSaveMealAction.
      if (row.entryMode === 'cheat') {
        // Validate the staged spec rather than blindly destructuring: a
        // malformed payload (e.g. {}) wouldn't throw and would surface a card
        // with cheatSpec: undefined. Throwing routes it through the catch below,
        // which skips + logs it like any other malformed row.
        const spec = (row.pipelineResult as { spec?: unknown } | null)?.spec;
        if (
          !spec ||
          typeof spec !== 'object' ||
          !Array.isArray((spec as { sliders?: unknown }).sliders)
        ) {
          throw new Error('Malformed cheat pending analysis payload');
        }
        return [{ ...base, cheatSpec: spec as CheatSliderSpec }];
      }
      return [
        {
          ...base,
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

// ---------------------------------------------------------------------------
// Repeat a previous cheat occasion (no AI call)
// ---------------------------------------------------------------------------

/** A distinct past cheat occasion, surfaced as a chip above the input. */
export interface RecentCheatOccasion {
  /** Source meal id — re-staged on tap to seed a fresh slider card. */
  mealId: string;
  /** The occasion text (e.g. "Korean BBQ buffet"), shown on the chip. */
  rawInput: string;
  loggedAt: string;
}

const loadRecentCheatOccasionsSchema = z.object({
  limit: z.number().int().min(1).max(12).optional(),
});

/**
 * Recent, de-duplicated cheat occasions for the current user — the source for
 * the "log it again" chips. Dedup is by occasion text (most recent kept) so a
 * place the user cheats at often shows up once, not five times.
 */
export async function loadRecentCheatOccasionsAction(input: {
  limit?: number;
}): Promise<RecentCheatOccasion[]> {
  const parsed = loadRecentCheatOccasionsSchema.parse(input);
  const { user } = await requireAuthAndProfile();
  const limit = parsed.limit ?? 5;

  const rows = await db
    .select({
      id: meals.id,
      rawInput: meals.rawInput,
      loggedAt: meals.loggedAt,
    })
    .from(meals)
    .where(and(eq(meals.userId, user.id), eq(meals.entryMode, 'cheat')))
    .orderBy(desc(meals.loggedAt))
    .limit(60);

  // Group near-duplicate occasions (e.g. "korean bbq" / "Korean BBQ buffet")
  // so a place the user cheats at often shows up once, keeping its newest wording.
  return groupOccasions(rows, limit).map((row) => ({
    mealId: row.id,
    rawInput: row.rawInput,
    loggedAt: row.loggedAt.toISOString(),
  }));
}

const stageCheatRepeatSchema = z.object({
  sourceMealId: z.string().uuid('sourceMealId phải là UUID hợp lệ.'),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/**
 * Repeat a past cheat occasion without re-running the estimator: re-stage its
 * stored slider spec as a fresh pending analysis, with each slider's default
 * pre-set to last time's chosen level (the user can still nudge — this time's
 * amounts may differ). Confirm then flows through the normal cheat path.
 */
export async function stageCheatRepeatAction(input: {
  sourceMealId: string;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<{
  analysisId: string;
  spec: CheatSliderSpec;
  rawInput: string;
  loggedAt: string;
}> {
  const parsed = stageCheatRepeatSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  const [source] = await db
    .select({
      rawInput: meals.rawInput,
      cheatSliders: meals.cheatSliders,
      entryMode: meals.entryMode,
    })
    .from(meals)
    .where(and(eq(meals.id, parsed.sourceMealId), eq(meals.userId, user.id)))
    .limit(1);

  if (!source || source.entryMode !== 'cheat' || !source.cheatSliders) {
    throw Errors.validationFailed('Không tìm thấy bữa xả trước đó.');
  }

  const { spec, levels } = source.cheatSliders as CheatSlidersPersisted;
  const repeatSpec = withLevelsAsDefaults(spec, levels);

  const loggedAt = getUtcInstantForLocalDate(
    parsed.loggedDate,
    parsed.timezoneOffset
  );

  const [inserted] = await db
    .insert(pendingAnalyses)
    .values({
      userId: user.id,
      pipelineResult: { entryMode: 'cheat', spec: repeatSpec },
      rawInput: source.rawInput,
      entryMode: 'cheat',
      loggedAt,
    })
    .returning({ id: pendingAnalyses.id });

  return {
    analysisId: inserted.id,
    spec: repeatSpec,
    rawInput: source.rawInput,
    loggedAt: loggedAt.toISOString(),
  };
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
// C4: Edit a persisted meal (gram overrides + per-row removal)
// ---------------------------------------------------------------------------

/** Scale every stored nutrient on a row by `ratio`, preserving nulls. */
function scaleNutritionRow(
  row: Record<string, unknown>,
  ratio: number
): NutritionValues {
  const result = { ...EMPTY_NUTRITION };
  for (const key of NUTRITION_KEYS) {
    const raw = row[key];
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : null;
    result[key] =
      value != null && Number.isFinite(value) ? value * ratio : null;
  }
  return result;
}

/**
 * Edit a persisted (precise) meal: override the cooked grams of stored items
 * and/or remove some of them, then recompute the meal totals from what remains.
 *
 * Tenant isolation: Drizzle bypasses Supabase RLS, so the `WHERE userId` filter
 * is the ONLY thing keeping one user out of another's meals. Every query here is
 * re-scoped to the authenticated `user.id` (the meal lookup) or constrained to
 * that meal's own item rows — mirroring `deleteMealAction`'s guard exactly. A
 * user can therefore never edit or drop a row belonging to someone else.
 */
export async function updateMealAction(input: {
  mealId: string;
  edits?: { id: string; newGrams: number }[];
  removeIds?: string[];
}): Promise<ConfirmMealResponse> {
  const parsed = updateMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    // Ownership gate: load the meal scoped to the authenticated user. A meal
    // belonging to anyone else simply isn't returned, so the edit can't proceed.
    const [meal] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
      .limit(1);

    if (!meal) {
      throw Errors.validationFailed(
        'Bữa ăn không tồn tại hoặc không thuộc về bạn.'
      );
    }
    if (meal.entryMode === 'cheat') {
      throw Errors.validationFailed(
        'Không thể chỉnh sửa bữa xả theo cách này.'
      );
    }

    // Item rows are reached only through this meal id, which we just proved the
    // caller owns — so they inherit the same tenant scope.
    const itemRows = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, meal.id));

    const editById = new Map(
      (parsed.edits ?? []).map((edit) => [edit.id, edit.newGrams])
    );
    const removeIds = new Set(parsed.removeIds ?? []);

    const keptRows = itemRows.filter((row) => !removeIds.has(row.id));
    if (keptRows.length === 0) {
      throw Errors.validationFailed(
        'Bữa ăn phải còn ít nhất một món. Hãy xóa cả bữa thay vào đó.'
      );
    }

    // Compute each kept row's new nutrition (scaled when a gram override applies)
    // and the new meal totals as their sum.
    const updates: {
      id: string;
      estimatedGrams: number;
      nutrition: NutritionValues;
    }[] = [];
    const keptNutrition: NutritionValues[] = [];

    for (const row of keptRows) {
      const newGrams = editById.get(row.id);
      const currentGrams = row.estimatedGrams;
      if (
        newGrams !== undefined &&
        currentGrams != null &&
        currentGrams > 0 &&
        newGrams !== currentGrams
      ) {
        const ratio = newGrams / currentGrams;
        const scaled = scaleNutritionRow(row, ratio);
        updates.push({
          id: row.id,
          estimatedGrams: newGrams,
          nutrition: scaled,
        });
        keptNutrition.push(scaled);
      } else {
        keptNutrition.push(extractNutritionValues(row));
      }
    }

    const mealTotals = sumDisplayedNutrition(keptNutrition);

    // Alcohol is tracked on the meal, not per item, so it can't be recomputed
    // from rows the way the macros are. Approximate it by the change in total
    // mass: shrinking or dropping items scales the alcohol down proportionally,
    // mirroring how the displayed macros fall. (Exact per-ingredient alcohol
    // would need a schema change; this keeps the number from going stale.)
    const oldTotalGrams = itemRows.reduce(
      (sum, row) => sum + (row.estimatedGrams ?? 0),
      0
    );
    const newKeptGrams = keptRows.reduce(
      (sum, row) => sum + (editById.get(row.id) ?? row.estimatedGrams ?? 0),
      0
    );
    const massRatio = oldTotalGrams > 0 ? newKeptGrams / oldTotalGrams : 0;
    const newAlcoholG =
      meal.alcoholG != null ? meal.alcoholG * massRatio : null;

    // Apply: scale the edited item rows, drop the removed ones, write the new
    // meal totals — all scoped to this meal's ids.
    for (const update of updates) {
      await tx
        .update(mealItems)
        .set({
          estimatedGrams: update.estimatedGrams,
          ...nutritionValuesToRow(update.nutrition),
        })
        .where(and(eq(mealItems.id, update.id), eq(mealItems.mealId, meal.id)));
    }

    if (removeIds.size > 0) {
      await tx
        .delete(mealItems)
        .where(
          and(
            eq(mealItems.mealId, meal.id),
            inArray(mealItems.id, Array.from(removeIds))
          )
        );
    }

    await tx
      .update(meals)
      .set({ ...nutritionValuesToRow(mealTotals), alcoholG: newAlcoholG })
      .where(and(eq(meals.id, meal.id), eq(meals.userId, user.id)));

    // Rebuild the saved meal in the exact shape loadMealsByDate returns so the
    // client reconciles its card in place — same id, no day refetch.
    const nutritionByRowId = new Map(
      updates.map((update) => [update.id, update.nutrition])
    );
    const mealItemGroups = buildMealItemGroupsFromRows(
      keptRows.map((row) => ({
        ...row,
        estimatedGrams: editById.get(row.id) ?? row.estimatedGrams ?? null,
        nutrition: nutritionByRowId.get(row.id) ?? extractNutritionValues(row),
      }))
    );

    // Editing amounts must NOT change share state: carry the meal's existing
    // share row through so the reconciled card keeps its "shared" badge instead
    // of silently resetting to private until the next day refetch.
    const [shareRow] = await tx
      .select({ id: mealShares.id, visibility: mealShares.visibility })
      .from(mealShares)
      .where(eq(mealShares.mealId, meal.id))
      .limit(1);

    const savedMeal = buildPersistedMeal({
      id: meal.id,
      rawInput: meal.rawInput,
      mealSlot: meal.mealSlot,
      confidenceOverall: meal.confidenceOverall,
      loggedAt: meal.loggedAt.toISOString(),
      nutrition: mealTotals,
      mealItemGroups,
      entryMode: 'precise',
      alcoholG: newAlcoholG,
      cheatSliders: null,
      share: shareRow
        ? { shareId: shareRow.id, visibility: shareRow.visibility }
        : null,
    });

    return { mealId: meal.id, meal: savedMeal };
  });
}

// ---------------------------------------------------------------------------
// C4b: Duplicate a persisted meal ("log again")
// ---------------------------------------------------------------------------

const duplicateMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
  // Client-generated id so the optimistic card and the persisted row share a
  // stable React key (mirrors confirm/manual save).
  newMealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/**
 * "Log again": reproduce an existing meal exactly by copying its stored item
 * rows (composition ids, grams, per-row nutrition) into a brand-new meal
 * stamped for the chosen day. No AI pipeline runs, so the accepted numbers — and
 * any prior manual gram edits — are preserved verbatim instead of being
 * re-estimated from the raw text (which is what re-submitting the text would do).
 *
 * Tenant isolation: the source meal is loaded scoped to the authenticated user;
 * its item rows are reached only through that meal's id — mirroring
 * `updateMealAction`'s guard.
 */
export async function duplicateMealAction(input: {
  mealId: string;
  newMealId?: string;
  loggedDate: string;
  timezoneOffset: number;
}): Promise<ConfirmMealResponse> {
  const parsed = duplicateMealSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  return await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(meals)
      .where(and(eq(meals.id, parsed.mealId), eq(meals.userId, user.id)))
      .limit(1);

    if (!source) {
      throw Errors.validationFailed(
        'Bữa ăn không tồn tại hoặc không thuộc về bạn.'
      );
    }
    // Cheat meals carry no item rows (their nutrition lives in the slider spec);
    // duplicating one as a precise meal would drop that, so refuse here.
    if (source.entryMode === 'cheat') {
      throw Errors.validationFailed('Không thể ghi lại bữa xả theo cách này.');
    }

    const sourceItems = await tx
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, source.id));

    // A re-log is a new eating event "now" on the chosen day, so the slot is
    // inferred from the new instant rather than copied from the original.
    const loggedAt = getUtcInstantForLocalDate(
      parsed.loggedDate,
      parsed.timezoneOffset
    );
    const mealSlot = inferMealSlot(loggedAt);
    const mealNutrition = extractNutritionValues(source);

    const [meal] = await tx
      .insert(meals)
      .values({
        ...(parsed.newMealId ? { id: parsed.newMealId } : {}),
        userId: user.id,
        rawInput: source.rawInput,
        mealSlot,
        confidenceOverall: source.confidenceOverall,
        loggedAt,
        entryMode: 'precise',
        alcoholG: source.alcoholG,
        ...nutritionValuesToRow(mealNutrition),
      })
      .returning({ id: meals.id });

    // Copy each item with a fresh id, preserving order/composition/grams and the
    // stored per-row nutrition exactly (extract → write the same values back).
    const copies = sourceItems.map((row) => ({
      id: randomUUID(),
      row,
      nutrition: extractNutritionValues(row),
    }));

    if (copies.length > 0) {
      await tx.insert(mealItems).values(
        copies.map(({ id, row, nutrition }) => ({
          id,
          mealId: meal.id,
          ingredientName: row.ingredientName,
          mealItemName: row.mealItemName,
          mealItemOrder: row.mealItemOrder,
          foodCompositionId: row.foodCompositionId,
          estimatedGrams: row.estimatedGrams,
          userFacingUnit: row.userFacingUnit,
          cookingMethod: row.cookingMethod,
          matchConfidence: row.matchConfidence,
          ...nutritionValuesToRow(nutrition),
        }))
      );
    }

    // Rebuild the saved meal in loadMealsByDate's shape, grouped by dish, so the
    // client reconciles its optimistic card in place (same id, no day refetch).
    const mealItemGroups = buildMealItemGroupsFromRows(
      copies.map(({ id, row, nutrition }) => ({ ...row, id, nutrition }))
    );

    const savedMeal = buildPersistedMeal({
      id: meal.id,
      rawInput: source.rawInput,
      mealSlot,
      confidenceOverall: source.confidenceOverall,
      loggedAt: loggedAt.toISOString(),
      nutrition: mealNutrition,
      mealItemGroups,
      entryMode: 'precise',
      alcoholG: source.alcoholG ?? null,
      cheatSliders: null,
      share: null,
    });

    return { mealId: meal.id, meal: savedMeal };
  });
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

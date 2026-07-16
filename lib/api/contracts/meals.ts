/**
 * Contract for the meals / logging REST surface (`/api/v1/meals/*`,
 * `/api/v1/logging/*`).
 *
 * Imported by the mobile (React Native) client, so this file must NEVER
 * value-import a server action or any 'server-only'/db/supabase module. It
 * contains only:
 *   - Zod request schemas depending solely on 'zod' and pure modules.
 *   - `export type` re-exports of the actions' return types (erased at runtime).
 */
import { z } from 'zod';
import { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';

export { dateStringSchema, timezoneOffsetSchema } from '@/lib/validation';

/**
 * Request body for `POST /api/v1/meals/confirm` → `confirmAndSaveMealAction`.
 *
 * Mirrors the (un-exported) `confirmAndSaveSchema` in lib/actions/meals.ts
 * exactly: an `analysisId` UUID, an optional client-generated `mealId` UUID,
 * and optional quantity-override `edits`. Omitting `ingredientIndex` scales the
 * whole dish, so `newGrams` is the new total cooked weight.
 */
export const confirmMealSchema = z.object({
  analysisId: z.string().uuid('analysisId phải là UUID hợp lệ.'),
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
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
  // Cheat-meal: chosen slider positions (0–10 per axis). Must mirror
  // `confirmAndSaveSchema` — Zod strips unknown keys, so omitting this here
  // would silently save mobile cheat confirms at the spec's default levels.
  levels: z
    .partialRecord(
      z.enum(['protein', 'carbs', 'fat', 'drinks']),
      z.number().min(0).max(10)
    )
    .optional(),
});

export type ConfirmMealInput = z.infer<typeof confirmMealSchema>;

/**
 * Request body for `POST /api/v1/meals/manual` → `saveManualMealAction`.
 *
 * Deterministic manual logging: the client sends ingredient ids + grams; the
 * server computes nutrition from per-100g composition data and persists the
 * meal directly — no AI pipeline, no pendingAnalyses staging. `mealId` is the
 * optional client-generated id so the optimistic card and the persisted row
 * share a stable key.
 */
export const saveManualMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  items: z
    .array(
      z.object({
        foodCompositionId: z.string().min(1).max(120),
        grams: z.number().positive().finite().max(5000),
        // The user's raw typed text, saved as the ingredient label. Falls back
        // to the composition's name server-side when absent.
        label: z.string().trim().min(1).max(200).optional(),
      })
    )
    .min(1)
    .max(30),
  mealSlot: z.enum(['breakfast', 'lunch', 'snack', 'dinner']).optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export type SaveManualMealInput = z.infer<typeof saveManualMealSchema>;

/**
 * Query params for `GET /api/v1/meals/cheat-occasions` →
 * `loadRecentCheatOccasionsAction`. Mirrors the action's (un-exported)
 * `loadRecentCheatOccasionsSchema`; `limit` arrives as a search param string.
 */
export const cheatOccasionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).optional(),
});

export type CheatOccasionsQuery = z.infer<typeof cheatOccasionsQuerySchema>;

/**
 * Request body for `POST /api/v1/meals/cheat-repeat` →
 * `stageCheatRepeatAction`. Mirrors the action's (un-exported)
 * `stageCheatRepeatSchema` exactly.
 */
export const cheatRepeatSchema = z.object({
  sourceMealId: z.string().uuid('sourceMealId phải là UUID hợp lệ.'),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export type CheatRepeatInput = z.infer<typeof cheatRepeatSchema>;

export type {
  ConfirmMealResponse,
  LoggingDayData,
  PendingMealConfirmation,
  PersistedIngredient,
  PersistedMeal,
  PersistedMealItemGroup,
  RecentCheatOccasion,
} from '@/lib/actions/meals/types';

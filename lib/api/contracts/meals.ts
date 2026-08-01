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
import {
  dateStringSchema,
  relogRefSchema,
  timezoneOffsetSchema,
} from '@/lib/validation';

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
 * Full input for `updateMealAction` (edit a persisted precise meal). Lives here
 * rather than in the action module because the action carries `'use server'`
 * (which may only export async functions) and this file is imported by the
 * mobile client — so the schema is defined once here and imported back by the
 * action. `updateMealBodySchema` is the request body for
 * `PATCH /api/v1/meals/[mealId]`: the same shape minus `mealId`, which the route
 * takes from the URL path.
 */
export const updateMealSchema = z.object({
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

export const updateMealBodySchema = updateMealSchema.omit({ mealId: true });

export type UpdateMealInput = z.infer<typeof updateMealSchema>;
export type UpdateMealBody = z.infer<typeof updateMealBodySchema>;

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

/**
 * Full input for `duplicateMealAction` ("log again"). Defined here (not in the
 * action module, which carries `'use server'` and may only export async
 * functions) and imported back by the action, so the request-body schema is
 * derived from it rather than hand-copied.
 *
 * `duplicateMealBodySchema` is the request body for
 * `POST /api/v1/meals/[mealId]/duplicate`: the same fields minus `mealId`, which
 * the route takes from the URL path (never the body) and the action loads
 * server-side scoped to the authenticated user, so no client-supplied meal
 * object is ever trusted.
 */
export const duplicateMealSchema = z.object({
  mealId: z.string().uuid('mealId phải là UUID hợp lệ.'),
  // Client-generated id so the optimistic card and the persisted row share a
  // stable React key (mirrors confirm/manual save).
  newMealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export const duplicateMealBodySchema = duplicateMealSchema.omit({
  mealId: true,
});

export type DuplicateMealInput = z.infer<typeof duplicateMealSchema>;
export type DuplicateMealBody = z.infer<typeof duplicateMealBodySchema>;

/**
 * Query params for `GET /api/v1/meals/relog/candidates` →
 * `loadRelogCandidatesAction`. The `/`-picker's search: an empty `q` returns
 * the user's top dishes and meals by the frequency×recency score, so there is
 * no separate "recents" endpoint.
 *
 * `q` is normalized to NFC because Vietnamese typed through Telex/VNI can
 * arrive decomposed, and the stored names are composed — comparing the two
 * forms byte-wise would silently miss.
 */
export const relogCandidatesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(60)
    .default('')
    .transform((value) => value.normalize('NFC')),
  limit: z.coerce.number().int().min(1).max(12).default(8),
});

export type RelogCandidatesQuery = z.infer<typeof relogCandidatesQuerySchema>;

/**
 * Full input for `relogMealItemsAction` → `POST /api/v1/meals/relog`.
 *
 * Every entry is a REFERENCE, never a payload: no nutrition, grams or names
 * cross the wire. The server re-resolves each one under `WHERE user_id = …`, so
 * a tampered or stale client can only ever point at its own rows (or at
 * nothing, which errors). A `dish` ref names one `meal_items` group; a `meal`
 * ref expands server-side into every dish of that meal.
 *
 * `newMealId` is the client-generated id so the optimistic card and the
 * persisted row share a stable React key (mirrors confirm/manual/duplicate).
 */
export const relogItemsSchema = z.object({
  newMealId: z.string().uuid('mealId phải là UUID hợp lệ.').optional(),
  items: z.array(relogRefSchema).min(1).max(20),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export type RelogItemsInput = z.infer<typeof relogItemsSchema>;

/**
 * Input for `stageRelogAnalysisAction` — the WEB pure-relog path. Instead of
 * writing a meal directly (as `relogMealItemsAction` does for mobile), it
 * stages a `pending_analyses` row so the picks land in the same editable review
 * card AI meals use. Same reference-only `items` as the relog contract; carries
 * `attemptId` (not `newMealId`) because the meal id is minted at confirm time,
 * and the attempt id lets a re-stage of the same card upsert its pending row.
 */
export const stageRelogAnalysisSchema = z.object({
  items: relogItemsSchema.shape.items,
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
  attemptId: z.string().uuid().optional(),
});

export type StageRelogAnalysisInput = z.infer<typeof stageRelogAnalysisSchema>;

export type {
  ConfirmMealResponse,
  LoggingDayData,
  PendingMealConfirmation,
  PersistedIngredient,
  PersistedMeal,
  PersistedMealItemGroup,
  RecentCheatOccasion,
} from '@/lib/actions/meals/types';
export type {
  RelogCandidate,
  RelogCandidatesResponse,
  RelogDishCandidate,
  RelogMealCandidate,
  RelogRef,
} from '@/lib/logging/relog/relog';

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
});

export type ConfirmMealInput = z.infer<typeof confirmMealSchema>;

export type {
  ConfirmMealResponse,
  LoggingDayData,
  PendingMealConfirmation,
  PersistedIngredient,
  PersistedMeal,
  PersistedMealItemGroup,
} from '@/lib/actions/meals';

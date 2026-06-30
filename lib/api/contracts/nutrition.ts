/**
 * Contracts for the nutrition REST surface
 * (`GET /api/v1/nutrition/overview`, `POST /api/v1/nutrition/candidates`).
 *
 * Imported by both web hooks and the mobile (React Native) client, so this
 * file value-imports ONLY pure modules: `zod` and `lib/nutrition/schemas`
 * (which depends solely on `zod` + a type-only import from
 * `lib/nutrition/catalog/nutrients`). It never value-imports a server action.
 */
import { z } from 'zod';
import {
  foodSourceCandidatesInputSchema,
  nutritionRangeInputSchema,
  timezoneOffsetSchema,
} from '@/lib/nutrition/schemas';

// Re-export the canonical pure building blocks so clients share one source of
// truth for the nutrition range, nullable timezone offset, and nutrient enum.
export {
  foodSourceCandidatesInputSchema,
  nutritionRangeInputSchema,
  timezoneOffsetSchema,
} from '@/lib/nutrition/schemas';

/**
 * Query schema for the overview endpoint. `range` accepts the input enum
 * (`'auto' | '7d' | '30d' | '90d'`) and `tz` the nullable timezone offset.
 * The action re-validates internally; this parses the query defensively first.
 */
export const overviewQuerySchema = z.object({
  range: nutritionRangeInputSchema,
  tz: timezoneOffsetSchema,
});

/**
 * Request body schema for the candidates endpoint. Mirrors
 * `foodSourceCandidatesInputSchema` ({ nutrient }) from the action source.
 */
export const candidatesSchema = z.object({
  nutrient: foodSourceCandidatesInputSchema.shape.nutrient,
});

// A food suggestion derived from the food-composition table: the food's name
// (Vietnamese + English) and its per-100g amount of the requested nutrient.
export type FoodSourceCandidate = {
  id: string;
  name: string;
  nameEn: string;
  amount: number;
  unit: string;
};

// Overview response type (exported interface from the action's type module).
export type { NutritionOverview } from '@/lib/nutrition/types';
export type CandidatesResponse = {
  nutrient: import('@/lib/nutrition/types').NutritionNutrientKey;
  foods: FoodSourceCandidate[];
};

import { z } from 'zod';
import { CANDIDATE_NUTRIENTS } from './catalog/nutrients';

export const nutritionRangeSchema = z.enum(['1d', '7d', '30d', '90d']);
export const nutritionRangeInputSchema = z.enum([
  'auto',
  '1d',
  '7d',
  '30d',
  '90d',
]);
export const timezoneOffsetSchema = z
  .number()
  .int()
  .min(-840)
  .max(720)
  .nullable();

export const nutritionDayScopeSchema = z.enum(['all', 'complete']);

export const nutritionOverviewInputSchema = z.object({
  range: nutritionRangeInputSchema,
  timezoneOffset: timezoneOffsetSchema,
  // Which day set the averages/series are scoped to. Absent = legacy behavior
  // (complete days with the all-partial safety valve). 'complete' is strict
  // (no valve → an under-logged period yields zero complete days).
  days: nutritionDayScopeSchema.optional(),
});

export const foodSourceCandidatesInputSchema = z.object({
  nutrient: z.enum(CANDIDATE_NUTRIENTS),
});

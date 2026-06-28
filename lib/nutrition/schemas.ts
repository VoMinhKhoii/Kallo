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

export const nutritionOverviewInputSchema = z.object({
  range: nutritionRangeInputSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export const foodSourceCandidatesInputSchema = z.object({
  nutrient: z.enum(CANDIDATE_NUTRIENTS),
});

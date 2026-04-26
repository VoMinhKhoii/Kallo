import { z } from 'zod';
import { SUPPORTED_CANDIDATE_NUTRIENTS } from './nutrients';

export const nutritionRangeSchema = z.enum(['7d', '30d', '90d']);
export const nutritionRangeInputSchema = z.enum(['auto', '7d', '30d', '90d']);
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
  nutrient: z.enum(SUPPORTED_CANDIDATE_NUTRIENTS),
});

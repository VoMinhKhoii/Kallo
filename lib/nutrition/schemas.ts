import { z } from 'zod';
import {
  DEFAULT_NUTRIENTS,
  MORE_NUTRIENTS,
  SUPPORTED_CANDIDATE_NUTRIENTS,
} from './nutrients';

const TREND_NUTRIENTS = [...DEFAULT_NUTRIENTS, ...MORE_NUTRIENTS] as const;

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

export const nutrientTrendInputSchema = z.object({
  nutrient: z.enum(TREND_NUTRIENTS),
  range: nutritionRangeSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export const foodSourceCandidatesInputSchema = z.object({
  nutrient: z.enum(SUPPORTED_CANDIDATE_NUTRIENTS),
});

import { z } from 'zod';
import { dateStringSchema } from '@/lib/validation';

const mealSchema = z.string().trim().min(1).max(300);

export interface LoggingSearchParams {
  meal?: string;
  date?: string;
}

export function parseLoggingSearchParams(
  rawParams: Record<string, string | undefined>
): LoggingSearchParams {
  const result: LoggingSearchParams = {};

  // Parse meal independently
  if (rawParams.meal !== undefined) {
    const mealParsed = mealSchema.safeParse(rawParams.meal);
    if (mealParsed.success) {
      result.meal = mealParsed.data;
    }
  }

  // Parse date independently
  if (rawParams.date !== undefined) {
    const dateParsed = dateStringSchema.safeParse(rawParams.date);
    if (dateParsed.success) {
      result.date = dateParsed.data;
    }
  }

  return result;
}

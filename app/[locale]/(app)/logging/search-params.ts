import { z } from 'zod';

const mealSchema = z.string().trim().min(1).max(300);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
    const dateParsed = dateSchema.safeParse(rawParams.date);
    if (dateParsed.success) {
      result.date = dateParsed.data;
    }
  }

  return result;
}

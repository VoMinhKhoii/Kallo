import { z } from 'zod';

export function isValidCalendarDateString(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD.')
  .refine(isValidCalendarDateString, 'Ngày không hợp lệ.');

export const timezoneOffsetSchema = z.number().int().min(-840).max(720);

/** Shared inner schema for a meal description string (used by API + feed submit). */
export const mealTextSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập món ăn.')
  .max(500, 'Tin nhắn quá dài (tối đa 500 ký tự).')
  .transform((s) => s.normalize('NFC'))
  .refine((s) => /\p{L}/u.test(s), 'Tin nhắn phải chứa ít nhất một chữ cái.');

/**
 * Schema for the meal analysis request body.
 * Validates the full `{ message }` payload — not just the string.
 */
export const mealMessageSchema = z.object({
  message: mealTextSchema,
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

/** Shared schema for a single weight log entry. */
export const weightLogSchema = z.object({
  loggedDate: dateStringSchema,
  weightKg: z
    .number()
    .min(30, 'Cân nặng phải lớn hơn hoặc bằng 30 kg.')
    .max(300, 'Cân nặng phải nhỏ hơn hoặc bằng 300 kg.'),
});

export type MealMessageInput = z.infer<typeof mealMessageSchema>;
export type WeightLogInput = z.infer<typeof weightLogSchema>;

import { z } from 'zod';

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
export const mealMessageSchema = z.object({ message: mealTextSchema });

export type MealMessageInput = z.infer<typeof mealMessageSchema>;

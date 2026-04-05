import { z } from 'zod';

/**
 * Schema for the meal analysis request body.
 * Validates the full `{ message }` payload — not just the string.
 */
export const mealMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập món ăn.')
    .max(500, 'Tin nhắn quá dài (tối đa 500 ký tự).')
    .transform((s) => s.normalize('NFC'))
    .refine((s) => /\p{L}/u.test(s), 'Tin nhắn phải chứa ít nhất một chữ cái.'),
});

export type MealMessageInput = z.infer<typeof mealMessageSchema>;

/**
 * Request schemas for logging a meal: the free-text description, relog
 * references, and the analyze-meal request body they combine into.
 */
import { z } from 'zod';
import {
  dateStringSchema,
  timezoneOffsetSchema,
} from '@/lib/validation/primitives';

const urlOnlyPattern = /^(?:https?:\/\/\S*|www\.\S*)$/iu;

function isHighlyRepetitiveSingleToken(value: string): boolean {
  if (/\s/u.test(value)) {
    return false;
  }

  const characters = Array.from(value.toLowerCase());
  return characters.length >= 8 && new Set(characters).size === 1;
}

/** Hard cap on a meal description — the NL-refine budget mirrors this. */
export const MEAL_TEXT_MAX_LENGTH = 500;

/** Shared inner schema for a meal description string (used by API + feed submit). */
export const mealTextSchema = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập món ăn.')
  .max(MEAL_TEXT_MAX_LENGTH, 'Tin nhắn quá dài (tối đa 500 ký tự).')
  .transform((s) => s.normalize('NFC'))
  .refine((s) => /\p{L}/u.test(s), 'Tin nhắn phải chứa ít nhất một chữ cái.')
  .refine((s) => !urlOnlyPattern.test(s), 'Vui lòng nhập mô tả món ăn.')
  .refine(
    (s) => !isHighlyRepetitiveSingleToken(s),
    'Vui lòng nhập mô tả món ăn.'
  );

/**
 * A single relog reference: a pointer the server re-resolves under
 * `WHERE user_id = …`, carrying NO nutrition/grams/names. A `dish` ref names one
 * `meal_items` group; a `meal` ref expands server-side to every dish of that
 * meal. Defined here so both the meals contract and the analyze-meal request
 * body reuse ONE schema — the picks a combined submit sends alongside free text
 * validate identically to a pure relog.
 */
export const relogRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('dish'),
    sourceMealId: z.string().uuid('sourceMealId phải là UUID hợp lệ.'),
    mealItemOrder: z.number().int().min(0).max(10_000),
  }),
  z.object({
    kind: z.literal('meal'),
    sourceMealId: z.string().uuid('sourceMealId phải là UUID hợp lệ.'),
  }),
]);

/**
 * Schema for the meal analysis request body.
 */
export const mealMessageSchema = z
  .object({
    message: mealTextSchema,
    locale: z.enum(['en', 'vi']).optional(),
    loggedDate: dateStringSchema,
    timezoneOffset: timezoneOffsetSchema,
    // Cheat-meal logging: when mode='cheat', the route runs the slider estimator
    // instead of the decomposition pipeline. `cheatType` is an optional chip and
    // `clarifyAnswer` carries the reply to a prior vague-input clarifying question.
    mode: z.enum(['precise', 'cheat']).optional(),
    cheatType: z.string().trim().max(60).optional(),
    clarifyAnswer: z.string().trim().max(200).optional(),
    // Indulgence magnitude for cheat mode — scales the slider anchor gram ranges.
    cheatIntensity: z.enum(['light', 'medium', 'heavy']).optional(),
    // NL-refine: the original meal's timestamp, so a correction re-analysis keeps
    // the meal's place in the timeline (and its inferred slot) instead of jumping
    // to "now". When present it overrides the loggedDate/timezoneOffset stamping.
    inheritLoggedAt: z.string().datetime().optional(),
    // Stable per-attempt id: re-analyzing the same card reuses it so the server
    // upserts one staging row instead of orphaning its predecessor. Optional —
    // absent from older clients / non-analyze staging paths.
    attemptId: z.string().uuid().optional(),
    // Combined relog: picks staged alongside free text. Only `message` runs the
    // AI pipeline; these are resolved deterministically and MERGED into the
    // result before staging, so relogged dishes are never re-analyzed. Precise
    // mode only (the cheat branch returns before relog handling).
    refs: z.array(relogRefSchema).min(1).max(20).optional(),
  })
  .refine(
    (data) => !(data.mode === 'cheat' && data.refs && data.refs.length > 0),
    {
      // Reject rather than silently drop: the cheat branch returns before the relog
      // merge, so accepting cheat+refs would quietly discard the user's picks.
      message: 'Không thể ghi lại món đã lưu ở chế độ xả.',
      path: ['refs'],
    }
  );

export type MealMessageInput = z.infer<typeof mealMessageSchema>;

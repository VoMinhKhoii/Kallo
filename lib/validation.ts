import { z } from 'zod';

const urlOnlyPattern = /^(?:https?:\/\/\S*|www\.\S*)$/iu;

function isHighlyRepetitiveSingleToken(value: string): boolean {
  if (/\s/u.test(value)) {
    return false;
  }

  const characters = Array.from(value.toLowerCase());
  return characters.length >= 8 && new Set(characters).size === 1;
}

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
  .refine((s) => /\p{L}/u.test(s), 'Tin nhắn phải chứa ít nhất một chữ cái.')
  .refine((s) => !urlOnlyPattern.test(s), 'Vui lòng nhập mô tả món ăn.')
  .refine(
    (s) => !isHighlyRepetitiveSingleToken(s),
    'Vui lòng nhập mô tả món ăn.'
  );

/**
 * Schema for the meal analysis request body.
 */
export const mealMessageSchema = z.object({
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

// ---------------------------------------------------------------------------
// Group tracking schemas
// ---------------------------------------------------------------------------

// Lowercase after validating: Postgres compares uuids case-insensitively, but
// the JS canonical-pair ordering (lib/groups/friendship.ts orderedPair) sorts
// lexicographically, so an uppercase-hex id would order differently than the
// stored lowercase row. Normalising here keeps both authorities in agreement.
const uuidSchema = z.string().uuid('Phải là UUID hợp lệ.').toLowerCase();

/**
 * A handle as accepted by the API: lowercased, 3-20 chars, [a-z0-9_]. The
 * reserved-handle blocklist is enforced separately via lib/groups/handles.ts
 * (validateHandle) so the rejection reason can be distinguished.
 */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Handle phải có ít nhất 3 ký tự.')
  .max(20, 'Handle tối đa 20 ký tự.')
  .regex(/^[a-z0-9_]+$/u, 'Handle chỉ gồm chữ thường, số và dấu gạch dưới.');

/** Upsert the caller's own public profile. */
export const upsertPublicProfileSchema = z.object({
  handle: handleSchema,
  displayName: z.string().trim().min(1).max(50).optional(),
  avatarSeed: z.string().trim().min(1).max(64).optional(),
});

export const blockFriendSchema = z.object({
  targetUserId: uuidSchema,
});

export const removeFriendSchema = z.object({
  targetUserId: uuidSchema,
});

/** Accept a link invite, identified by the inviter's editable link slug. */
export const acceptInviteSchema = z.object({
  slug: handleSchema,
});

export const setMealShareVisibilitySchema = z.object({
  mealId: uuidSchema,
  visibility: z.enum(['private', 'circle']),
});

export const circleFeedSchema = z.object({
  timezoneOffset: timezoneOffsetSchema,
});

export type HandleInput = z.infer<typeof handleSchema>;
export type UpsertPublicProfileInput = z.infer<
  typeof upsertPublicProfileSchema
>;
export type SetMealShareVisibilityInput = z.infer<
  typeof setMealShareVisibilitySchema
>;

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
export const uuidSchema = z.string().uuid('Phải là UUID hợp lệ.').toLowerCase();

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

/** Upsert the caller's own public profile.
 *
 * `displayName` is tri-state: omitted = keep the stored value, `null` = clear
 * it (fall back to the handle), string = set it. A slug-only save must never
 * wipe the display name. `avatarSeed` likewise only overwrites when provided. */
export const upsertPublicProfileSchema = z.object({
  handle: handleSchema,
  displayName: z.string().trim().min(1).max(50).nullish(),
  avatarSeed: z.string().trim().min(1).max(64).optional(),
});

/** Rename the caller's profile ("what should we call you") — the handle is
 * re-derived from the name server-side, so only the name comes in. */
export const renameProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
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

/** Share one of my meals with specific friends as a full copy or a split. */
export const shareMealWithFriendsSchema = z.object({
  mealId: uuidSchema,
  friendUserIds: z.array(uuidSchema).min(1).max(20),
  mode: z.enum(['copy', 'split']),
});

/** Accept a pending meal-share invite into my own diary for the chosen day. */
export const acceptMealShareInviteSchema = z.object({
  inviteId: uuidSchema,
  // Client-generated id so the optimistic card and the persisted row share a
  // stable React key (mirrors confirm/duplicate).
  newMealId: uuidSchema.optional(),
  loggedDate: dateStringSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export const dismissMealShareInviteSchema = z.object({
  inviteId: uuidSchema,
});

/** Opaque tuple cursor shared by the friend/group history feeds. A plain ISO
 * timestamp remains valid for legacy Flutter clients. */
const beforeCursorSchema = z.string().trim().min(1).max(500).optional();

/** Fetch the combined Friends thread's shared-meal history (the actor plus
 * every accepted friend), newest-first, paginated. */
export const friendsThreadFeedSchema = z.object({
  before: beforeCursorSchema,
});

/** Create a named group chat from a multi-select of the actor's friends. */
export const createChatGroupSchema = z.object({
  name: z.string().trim().min(1, 'Tên nhóm không được để trống.').max(60),
  // The 49 invitee cap plus the owner enforces the 50-member group limit.
  memberUserIds: z
    .array(uuidSchema)
    .min(1, 'Chọn ít nhất một thành viên.')
    .max(49, 'Nhóm tối đa 50 thành viên.'),
});

/** Fetch one membership-gated chat group by path id. */
export const getChatGroupSchema = z.object({
  groupId: uuidSchema,
});

/** Add members to an existing named group (same cap rationale as create). */
export const addChatGroupMembersSchema = z.object({
  groupId: uuidSchema,
  memberUserIds: z
    .array(uuidSchema)
    .min(1, 'Chọn ít nhất một thành viên.')
    .max(50, 'Nhóm tối đa 50 thành viên.'),
});

/** Owner removes one member from a named group. */
export const removeChatGroupMemberSchema = z.object({
  groupId: uuidSchema,
  memberUserId: uuidSchema,
});

/** Owner renames a named group. */
export const renameChatGroupSchema = z.object({
  groupId: uuidSchema,
  name: z.string().trim().min(1, 'Tên nhóm không được để trống.').max(60),
});

export const sendChatGroupMessageSchema = z.object({
  groupId: uuidSchema,
  body: z.string().trim().min(1).max(2000),
});

/** Fetch a group thread's shared-meal history, newest-first, paginated. */
export const groupMealFeedSchema = z.object({
  groupId: uuidSchema,
  before: beforeCursorSchema,
});

/** Remove the actor from one membership-gated chat group. */
export const leaveChatGroupSchema = z.object({
  groupId: uuidSchema,
});

export type HandleInput = z.infer<typeof handleSchema>;
export type UpsertPublicProfileInput = z.infer<
  typeof upsertPublicProfileSchema
>;
export type SetMealShareVisibilityInput = z.infer<
  typeof setMealShareVisibilitySchema
>;

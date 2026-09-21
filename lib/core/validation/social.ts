/**
 * Request schemas for the social circle: public profile and handle, friendship
 * edges, and meal sharing between friends. Named group chats live in
 * `@/lib/core/validation/chat`.
 */
import { z } from 'zod';
import {
  beforeCursorSchema,
  dateStringSchema,
  timezoneOffsetSchema,
  uuidSchema,
} from '@/lib/core/validation/primitives';

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

/** Share one of my meals with specific friends as a full copy or a split.
 *
 *  `splits` carries an UNEVEN split: whole parts of a 20-part dish, one entry
 *  per recipient, plus the sender's own `myParts`. Integers on purpose — the
 *  server asserts they sum to exactly 20, which is one equality check instead
 *  of chasing "do these fractions add to 0.9999?". Omit both for the even
 *  1/(N+1) split, which is the shipped behaviour and stays untouched.
 *
 *  The bounds here are only the cheap per-field ones; the relationships
 *  between them (sum, party size, duplicate recipients) live in
 *  `assertPartsValid` so both platforms and the action share one rule set. */
export const shareMealWithFriendsSchema = z
  .object({
    mealId: uuidSchema,
    friendUserIds: z.array(uuidSchema).min(1).max(20),
    mode: z.enum(['copy', 'split']),
    myParts: z.number().int().min(2).max(18).optional(),
    splits: z
      .array(
        z.object({ userId: uuidSchema, parts: z.number().int().min(2).max(18) })
      )
      .min(1)
      .max(5)
      .optional(),
  })
  .refine((v) => (v.myParts == null) === (v.splits == null), {
    message: 'myParts và splits phải đi cùng nhau.',
  })
  .refine((v) => v.mode === 'split' || v.splits == null, {
    message: 'Chỉ chia phần mới đặt được tỉ lệ.',
  })
  .refine(
    (v) =>
      v.splits == null ||
      v.splits.every((s) => v.friendUserIds.includes(s.userId)),
    { message: 'Tỉ lệ phải khớp với những người được chọn.' }
  )
  .refine(
    (v) => v.splits == null || v.splits.length === v.friendUserIds.length,
    {
      message: 'Mỗi người được chọn cần một phần.',
    }
  );

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

/**
 * Take a CHEAT invite by reopening the sender's sliders.
 *
 * No `loggedDate`/`timezoneOffset`, unlike accept above: nothing is logged by
 * this call. The staged card inherits the source meal's instant, and the
 * recipient sets their own amounts before confirming through the ordinary
 * cheat path. No `newMealId` either — the meal id is minted at confirm time.
 */
export const stageCheatInviteSchema = z.object({
  inviteId: uuidSchema,
});

/** Read one shared meal (the per-post thread page) by its share id. */
export const shareThreadSchema = z.object({
  shareId: uuidSchema,
});

/** Fetch the combined Friends thread's shared-meal history (the actor plus
 * every accepted friend), newest-first, paginated. */
export const friendsThreadFeedSchema = z.object({
  before: beforeCursorSchema,
});

export type HandleInput = z.infer<typeof handleSchema>;
export type UpsertPublicProfileInput = z.infer<
  typeof upsertPublicProfileSchema
>;
export type SetMealShareVisibilityInput = z.infer<
  typeof setMealShareVisibilitySchema
>;

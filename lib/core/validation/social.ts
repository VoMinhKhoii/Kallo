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

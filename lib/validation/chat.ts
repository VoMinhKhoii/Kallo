/**
 * Request schemas for named group chats: membership, messages, and the group
 * shared-meal feed. One-to-one friendship lives in `@/lib/validation/social`.
 */
import { z } from 'zod';
import { beforeCursorSchema, uuidSchema } from '@/lib/validation/primitives';

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

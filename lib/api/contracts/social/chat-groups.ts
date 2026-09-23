/**
 * Contract for the chat-group write surface (`POST /api/v1/chat-groups`,
 * `POST /api/v1/chat-groups/{groupId}/members`).
 *
 * Parsed by the route handlers and published through `fromZod` in the OpenAPI
 * spec, so this file must NEVER value-import a server action or any
 * 'server-only'/db/supabase module. The field rules (trimmed 1–60 char name,
 * 1–49/50 uuid member ids) are the action-level ones from
 * `@/lib/core/validation/chat`, reused here rather than re-declared, so the
 * route boundary, the action and the published spec share one definition.
 *
 * `groupId` is NOT part of the add-members body: it comes from the path.
 * Unknown keys are stripped (Zod's default), so nothing a client adds to the
 * body reaches the action.
 */
import { z } from 'zod';
import {
  addChatGroupMembersSchema,
  createChatGroupSchema,
} from '@/lib/core/validation/chat';

/** Drop repeated ids, keeping first-seen order. The action dedupes too; doing
 * it at the boundary means the bound applies to distinct people. */
const dedupe = (ids: string[]) => [...new Set(ids)];

/** Request body for `POST /api/v1/chat-groups`. */
export const createChatGroupBodySchema = z.object({
  name: createChatGroupSchema.shape.name,
  memberUserIds: createChatGroupSchema.shape.memberUserIds.transform(dedupe),
});

/** Request body for `POST /api/v1/chat-groups/{groupId}/members`. */
export const addChatGroupMembersBodySchema = z.object({
  memberUserIds:
    addChatGroupMembersSchema.shape.memberUserIds.transform(dedupe),
});

export type CreateChatGroupBody = z.infer<typeof createChatGroupBodySchema>;
export type AddChatGroupMembersBody = z.infer<
  typeof addChatGroupMembersBodySchema
>;

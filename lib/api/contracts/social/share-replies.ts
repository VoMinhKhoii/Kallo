/**
 * Contract for `POST /api/v1/groups/shares/reply`.
 *
 * Parsed by the route handler, re-parsed by `createShareReplyAction` (the web
 * calls it directly as a Server Action) and published through `fromZod` in the
 * OpenAPI spec, so this file must NEVER value-import a server action or any
 * 'server-only'/db/supabase module.
 */
import { z } from 'zod';

export const createShareReplyBodySchema = z.object({
  shareId: z.string().uuid('shareId phải là UUID hợp lệ.').toLowerCase(),
  replyId: z
    .string()
    .uuid('replyId phải là UUID hợp lệ.')
    .toLowerCase()
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, 'Nội dung trả lời không được để trống.')
    .max(500, 'Nội dung trả lời tối đa 500 ký tự.'),
});

export type CreateShareReplyBody = z.infer<typeof createShareReplyBodySchema>;

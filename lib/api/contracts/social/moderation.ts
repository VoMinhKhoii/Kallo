/**
 * Contract for the circle moderation surface: unblocking someone
 * (`POST /api/v1/groups/friends/unblock`) and reporting content
 * (`POST /api/v1/reports`).
 *
 * Parsed by the route handlers and published through `fromZod` in the OpenAPI
 * spec, so this file must NEVER value-import a server action or any
 * 'server-only'/db/supabase module. The enum values are the wire values the
 * Flutter client sends (lib/models/social/moderation.dart) and the ones the
 * `content_reports` CHECK constraints accept.
 */
import { z } from 'zod';
import { uuidSchema } from '@/lib/core/validation/primitives';

/** What can be reported. Each is identified by a uuid; a `profile` by the
 * person's user id. */
export const REPORT_TARGET_KINDS = [
  'share',
  'reply',
  'chat_message',
  'profile',
  'chat_group',
] as const;

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'self_harm',
  'other',
] as const;

export type ReportTargetKind = (typeof REPORT_TARGET_KINDS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Request body for `POST /api/v1/groups/friends/unblock`. */
export const unblockUserBodySchema = z.object({
  targetUserId: uuidSchema,
});

/** Request body for `POST /api/v1/reports`. There is no reported-person field:
 * the server derives the person from the target itself. Unknown keys are
 * stripped (Zod's default), so an older client still sending `targetUserId`
 * keeps working. */
export const createReportBodySchema = z.object({
  targetKind: z.enum(REPORT_TARGET_KINDS),
  targetId: uuidSchema,
  reason: z.enum(REPORT_REASONS),
  note: z
    .string()
    .trim()
    .max(500, 'Ghi chú tối đa 500 ký tự.')
    .optional()
    .transform((note) => (note ? note : undefined)),
});

export type UnblockUserBody = z.infer<typeof unblockUserBodySchema>;
export type CreateReportBody = z.infer<typeof createReportBodySchema>;

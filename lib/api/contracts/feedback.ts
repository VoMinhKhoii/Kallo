/**
 * Contract for the in-app feedback surface (`POST /api/v1/feedback`).
 *
 * Imported by the mobile client, so this file must NEVER value-import a server
 * action or any 'server-only'/db/supabase module. It contains only Zod request
 * schemas depending solely on 'zod' and pure modules.
 *
 * Note: `userId` is intentionally NOT part of the request body — the server
 * action derives it from the authed session so a client can never attribute
 * feedback to someone else.
 */
import { z } from 'zod';

export const FEEDBACK_TYPES = ['bug', 'ingredient', 'idea'] as const;
export const FEEDBACK_PLATFORMS = ['web', 'ios', 'android'] as const;

/**
 * Storage object path shape produced by the screenshot upload:
 * `{uuid}/{uuid}.{ext}`. The first segment is the uploader's user id — the
 * server additionally verifies it matches the session (see submitFeedbackAction),
 * so this pattern both blocks path traversal and encodes the ownership contract.
 */
export const SCREENSHOT_PATH_PATTERN =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/;

/** Request body for `POST /api/v1/feedback` → `submitFeedbackAction`. */
export const submitFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  message: z.string().trim().min(1, 'Message is required.').max(4000),
  // Storage object path returned by the client-side screenshot upload.
  screenshotPath: z
    .string()
    .regex(SCREENSHOT_PATH_PATTERN, 'Invalid screenshot path.')
    .optional(),
  // Context captured client-side at submit time.
  appVersion: z.string().max(64).optional(),
  platform: z.enum(FEEDBACK_PLATFORMS).optional(),
  locale: z.string().max(16).optional(),
  route: z.string().max(512).optional(),
  // Extensibility for structured client context (OS version, screen size…).
  // Bounded to blunt jsonb-bloat / admin-page payload DoS. No client sends this
  // today, but the bounds keep it safe if one starts.
  metadata: z
    .record(z.string().max(64), z.string().max(1024))
    .refine((m) => Object.keys(m).length <= 32, 'Too many metadata keys.')
    .optional(),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

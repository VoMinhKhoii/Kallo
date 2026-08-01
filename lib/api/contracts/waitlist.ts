/**
 * Contract for the landing-page waitlist (`POST /api/v1/waitlist`).
 *
 * Client-safe: only Zod, never a server action, db, or supabase import.
 */
import { z } from 'zod';

export const WAITLIST_LOCALES = ['en', 'vi'] as const;

/** Where on the page the signup came from. Kept short and closed-ish. */
export const WAITLIST_SOURCES = ['hero', 'cta'] as const;

export const waitlistSignupSchema = z.object({
  // 254 is the RFC 5321 maximum for a full address; anything longer is junk.
  email: z.email('Enter a valid email address.').max(254),
  locale: z.enum(WAITLIST_LOCALES).optional(),
  source: z.enum(WAITLIST_SOURCES).optional(),
});

export type WaitlistSignupInput = z.infer<typeof waitlistSignupSchema>;

/**
 * The response is deliberately content-free. It is identical whether the
 * address is new, already pending, or already confirmed, so the endpoint can't
 * be used to test whether someone is on the list.
 */
export interface WaitlistSignupResponse {
  ok: true;
}

/** Outcomes the confirm link can produce, surfaced as `?waitlist=<status>`. */
export const WAITLIST_STATUSES = [
  'confirmed',
  'already',
  'expired',
  'invalid',
] as const;

export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

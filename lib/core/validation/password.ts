/**
 * The password policy, mirrored from Supabase Auth (GoTrue). The server is the
 * authority — production is set in the dashboard (Authentication → Sign In /
 * Providers → Email), local dev in `supabase/config.toml` — and these rules
 * exist only so a form can say what the server will say, before the round
 * trip. Change one side, change the other; `docs/AUTH_SECURITY.md` lists the
 * dashboard settings.
 *
 * - Length is measured the way GoTrue measures it, in UTF-8 BYTES (Go's
 *   `len(string)`). For ASCII that is the character count.
 * - The composition rule is GoTrue's `letters_digits`: at least one ASCII
 *   letter and one ASCII digit. GoTrue matches ASCII sets only, so an accented
 *   Vietnamese letter alone does not count as "a letter" there either.
 */
import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt, which Supabase hashes passwords with, only reads the first 72 bytes
 * of its input and silently ignores the rest — so two long passwords sharing a
 * 72-byte prefix would hash the same. GoTrue therefore rejects anything longer
 * outright, and so do we, so a passphrase is never accepted and then truncated.
 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * Why a new password failed. The schema carries these codes as its issue
 * messages instead of display copy; each form maps them to its own translated
 * line, since a shared module cannot know the locale.
 */
export type PasswordIssue =
  | 'too_short'
  | 'too_long'
  | 'needs_letter'
  | 'needs_digit';

const HAS_LETTER = /[A-Za-z]/;
const HAS_DIGIT = /\d/;

export function passwordByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

const fitsBcrypt = (value: string) =>
  passwordByteLength(value) <= PASSWORD_MAX_BYTES;

/** Each requirement a new password must meet, for live hints under a field. */
export function passwordRequirements(value: string) {
  return {
    length: value.length >= PASSWORD_MIN_LENGTH,
    letter: HAS_LETTER.test(value),
    digit: HAS_DIGIT.test(value),
  };
}

/**
 * A password being CREATED: sign-up and the reset-password page. Issue
 * messages are `PasswordIssue` codes.
 */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'too_short' satisfies PasswordIssue)
  .refine(fitsBcrypt, 'too_long' satisfies PasswordIssue)
  .regex(HAS_LETTER, 'needs_letter' satisfies PasswordIssue)
  .regex(HAS_DIGIT, 'needs_digit' satisfies PasswordIssue);

/**
 * A password being USED: sign-in. Deliberately none of the length or
 * composition rules — accounts created under the older 6-character policy
 * still hold those passwords, and the server, not this form, decides whether a
 * credential is right. Rejecting them here would lock those users out of the
 * account they need to reach in order to pick a stronger password. The byte
 * cap stays: GoTrue refuses anything longer on every endpoint.
 */
export const existingPasswordSchema = z
  .string()
  .min(1, 'required')
  .refine(fitsBcrypt, 'too_long' satisfies PasswordIssue);

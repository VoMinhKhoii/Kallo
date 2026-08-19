/**
 * The `before_user_created` hook rejects a social sign-up whose email already
 * belongs to an account created another way. Its rejection reaches the clients
 * as prose, so both the server callback (`app/auth/callback/route.ts`) and the
 * browser ID-token flow (`hooks/auth/use-google-identity.ts`) match on this
 * marker to show "you already have an account" instead of a generic failure.
 *
 * Hard contract with `supabase/migrations/20260629120000_block_duplicate_email_signup.sql`
 * (and the Flutter client's `authErrorMessage`). A test in
 * `app/auth/callback/route.test.ts` asserts the migration still contains this
 * string, so editing the SQL prose without updating the clients fails loudly.
 */
export const DUPLICATE_EMAIL_MARKER = 'already exists for this email';

/**
 * True when a Supabase error message (or an OAuth `error_description` query
 * param) carries the duplicate-email hook's marker. Accepts null/undefined so
 * callers can pass optional params without pre-coercing.
 */
export function isDuplicateEmailError(
  message: string | null | undefined
): boolean {
  return (message ?? '').toLowerCase().includes(DUPLICATE_EMAIL_MARKER);
}

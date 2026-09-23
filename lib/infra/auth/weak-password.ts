import type { AuthError } from '@supabase/supabase-js';

/**
 * Why Supabase Auth refused a NEW password, or `null` when it did not.
 *
 * GoTrue answers a sign-up or password change that breaks the password policy
 * with `code: 'weak_password'` and a `reasons` list: `length` and `characters`
 * for the rules the form already checks (so reaching the server with them
 * means the dashboard policy and `lib/core/validation/password.ts` have
 * drifted), and `pwned` when "Leaked password protection" is on and the
 * password is in the HaveIBeenPwned corpus. The form cannot check `pwned`
 * itself, and it deserves its own line: "choose a different one" is advice,
 * while a generic "could not create account" is a dead end.
 *
 * Duck-typed on `code` rather than `instanceof AuthWeakPasswordError`, the same
 * way `isRateLimitedAuthError` reads it, so a body relayed by our auth proxy
 * maps identically.
 */
export function weakPasswordReason(error: AuthError): 'pwned' | 'weak' | null {
  if (error.code !== 'weak_password') return null;
  const reasons: unknown = (error as { reasons?: unknown }).reasons;
  return Array.isArray(reasons) && reasons.includes('pwned') ? 'pwned' : 'weak';
}

import type { AuthError } from '@supabase/supabase-js';

/**
 * True when an auth failure was a throttle, not a bad credential.
 *
 * The web sign-in and sign-up forms both showed "Invalid email or password" /
 * "Could not create account" when Supabase (or our own auth proxy — see
 * `app/api/supabase-proxy/_lib/gotrue-error.ts`) refused the request for rate
 * limiting. That is the worst possible copy for it: it tells a user with the
 * right password that their password is wrong, so they retype it and get
 * throttled harder.
 *
 * Two signals, because either can arrive alone. supabase-js's `handleError`
 * reads `code` from the body's `error_code`, which is `over_request_rate_limit`
 * for GoTrue and for us — but the code is absent when a body has no error code
 * at all (an edge/proxy 429), and the status is what remains.
 *
 * The Flutter client has had this branch since launch
 * (`auth_form_controller.dart`); this is the web half of the same mapping.
 */
export function isRateLimitedAuthError(error: AuthError): boolean {
  return error.code === 'over_request_rate_limit' || error.status === 429;
}

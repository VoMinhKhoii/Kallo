import type { AuthError, SupabaseClient } from '@supabase/supabase-js';
import { isDuplicateEmailError } from '@/lib/infra/auth/duplicate-email';
import { isRateLimitedAuthError } from '@/lib/infra/auth/rate-limited';

/**
 * Email sign-in is code-only: the address gets a 6-digit code, the code signs
 * the person in, and a new address gets an account on the way. There is no
 * separate sign-up and no password.
 *
 * The Flutter twin is `apps/mobile-flutter/lib/features/auth/providers/`
 * `auth_form_controller.dart`; both send the same request, so the auth proxy
 * and the email hook see one shape.
 */

/**
 * The code lengths GoTrue can be configured with (`otp_length`, clamped to
 * 6–10). The field takes any of them rather than one fixed length: the hosted
 * dev project sends 8 digits while `supabase/config.toml` says 6, and a field
 * capped below the project's real length would lock every email sign-in out.
 */
export const EMAIL_CODE_MIN_LENGTH = 6;
export const EMAIL_CODE_MAX_LENGTH = 10;

/**
 * Matches Supabase's per-address resend cooldown (60 s hosted default). A
 * resend sooner than this is refused upstream, so the button waits it out.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * The `emailRedirectTo` every code request carries. No link is emailed, but
 * the email hook reads the locale from its `next`, and a request WITHOUT one
 * is how the hook recognises an iOS build released before code sign-in —
 * see `wantsLink` in `lib/infra/email/auth-email.ts`.
 */
export function emailCodeRedirect(
  origin: string,
  next: string | null,
  locale: string
): string {
  const target = next ?? `/${locale}/logging`;
  return `${origin}/auth/callback?next=${encodeURIComponent(target)}`;
}

export async function sendEmailCode(
  supabase: SupabaseClient,
  input: { email: string; emailRedirectTo: string; captchaToken: string | null }
): Promise<AuthError | null> {
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: input.emailRedirectTo,
      captchaToken: input.captchaToken ?? undefined,
    },
  });
  return error;
}

export type EmailCodeErrorKey =
  | 'rateLimited'
  | 'tooSoon'
  | 'captcha'
  | 'accountExists'
  | 'invalidCode'
  | 'generic';

/**
 * Which line of copy a failed send or verify gets. Never the raw message.
 *
 * `tooSoon` is Supabase's per-address cooldown (`over_email_send_rate_limit`),
 * which wants "wait a minute", not "too many attempts".
 */
export function emailCodeErrorKey(error: AuthError): EmailCodeErrorKey {
  if (error.code === 'over_email_send_rate_limit') return 'tooSoon';
  if (isRateLimitedAuthError(error)) return 'rateLimited';
  if (error.code === 'captcha_failed') return 'captcha';
  if (isDuplicateEmailError(error.message)) return 'accountExists';
  if (error.code === 'otp_expired' || error.code === 'invalid_credentials') {
    return 'invalidCode';
  }
  return 'generic';
}

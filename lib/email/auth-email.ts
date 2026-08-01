import { z } from 'zod';
import { localeFromNext } from '@/lib/auth/redirects';
import { safeNextPath } from '@/lib/auth/safe-next';
import type { EmailMessage } from '@/lib/email/send';
import {
  type AuthLinkKind,
  authLinkEmail,
} from '@/lib/email/templates/auth-link';
import { authOtpEmail } from '@/lib/email/templates/auth-otp';
import type { EmailLocale } from '@/lib/email/templates/layout';
import { SITE_URL } from '@/lib/site';

/**
 * Translates a Supabase "Send Email" auth-hook payload into the concrete
 * emails we send through Resend.
 *
 * The hard requirement is the link shape. `app/auth/verify/route.ts` exists
 * because `*.supabase.co` is blackholed on Vietnamese networks, so emails must
 * point at OUR `/auth/verify` route, and that route only accepts
 * `type ∈ {'email','recovery','email_change'}`. GoTrue's `email_action_type`
 * vocabulary is wider than that, so the mapping below is load-bearing: get it
 * wrong and confirmations bounce off a 400.
 */

/** Types `app/auth/verify/route.ts` will accept. Keep in sync with its zod enum. */
export type VerifyType = 'email' | 'recovery' | 'email_change';

/**
 * An address slot GoTrue may leave blank. It fills unused fields with `""`
 * rather than omitting them (see `old_email`/`old_phone` in Supabase's own
 * sample payload), so validating these as strict emails would reject the
 * ordinary signup payload and take down every auth email. Parse permissively
 * and normalise blanks to null; the recipient is checked at use.
 */
const optionalAddress = z
  .string()
  .nullish()
  .transform((value) => (value?.trim() ? value.trim() : null));

export const authEmailPayloadSchema = z.object({
  user: z.object({
    email: optionalAddress,
    new_email: optionalAddress,
  }),
  email_data: z.object({
    token: z.string().default(''),
    token_hash: z.string().default(''),
    token_new: z.string().default(''),
    token_hash_new: z.string().default(''),
    redirect_to: z.string().default(''),
    email_action_type: z.string(),
    site_url: z.string().default(''),
  }),
});

export type AuthEmailPayload = z.infer<typeof authEmailPayloadSchema>;

/** One rendered email, ready to hand to `sendEmail`. */
export interface ResolvedAuthEmail {
  to: string;
  message: EmailMessage;
  /** Resend tag value; also the log label. */
  kind: string;
}

/** GoTrue action → (our verify type, our template intent). */
const LINK_ACTIONS: Record<string, { type: VerifyType; kind: AuthLinkKind }> = {
  signup: { type: 'email', kind: 'confirm' },
  // GoTrue's non-deprecated alias for the signup/magic-link confirmation.
  email: { type: 'email', kind: 'signin' },
  magiclink: { type: 'email', kind: 'signin' },
  invite: { type: 'email', kind: 'invite' },
  recovery: { type: 'recovery', kind: 'recovery' },
};

/**
 * The locale the user was last seen in, recovered from the `next` parameter the
 * app embeds in `emailRedirectTo`. Falls back to the default locale, which is
 * what an unlocalised caller (the Flutter sign-up) gets.
 */
export function localeFromRedirect(redirectTo: string): EmailLocale {
  return localeFromNext(nextPathFromRedirect(redirectTo)) === 'vi'
    ? 'vi'
    : 'en';
}

/** The validated in-app path to land on after verifying, or null. */
function nextPathFromRedirect(redirectTo: string): string | null {
  if (!redirectTo) return null;
  try {
    return safeNextPath(new URL(redirectTo).searchParams.get('next'));
  } catch {
    return null;
  }
}

/** Build the `/auth/verify` URL the email links to. */
export function verifyUrl(
  tokenHash: string,
  type: VerifyType,
  redirectTo: string
): string {
  const url = new URL('/auth/verify', SITE_URL);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', type);
  const next = nextPathFromRedirect(redirectTo);
  if (next) url.searchParams.set('next', next);
  return url.toString();
}

/**
 * Resolve a hook payload into zero or more emails.
 *
 * Returns an empty array for actions we deliberately don't send (GoTrue's
 * `*_notification` events) — the caller still answers 200, because those are
 * informational and failing them would block the underlying auth operation.
 */
export function resolveAuthEmails(
  payload: AuthEmailPayload
): ResolvedAuthEmail[] {
  const { user, email_data: data } = payload;
  const action = data.email_action_type;
  const locale = localeFromRedirect(data.redirect_to);

  // `email_change_current` / `email_change_new` are the per-recipient template
  // names older GoTrue builds send as the action type. Route them through the
  // same path so an upgrade skew can't silently drop a change confirmation.
  if (action.startsWith('email_change')) {
    return emailChangeEmails(payload, locale);
  }

  if (action === 'reauthentication') {
    if (!user.email || !data.token) return [];
    return [
      {
        to: user.email,
        message: authOtpEmail(locale, data.token),
        kind: action,
      },
    ];
  }

  const mapping = LINK_ACTIONS[action];
  if (!mapping) {
    // A GoTrue action we don't map (e.g. a new type after an upgrade) would
    // otherwise drop the email with no trace. app/api/auth/send-email/route.test
    // locks the known set, so this only fires on genuinely new vocabulary.
    console.warn(`[auth-email] no template for action: ${action}`);
    return [];
  }
  if (!user.email || !data.token_hash) return [];

  return [
    {
      to: user.email,
      message: authLinkEmail({
        locale,
        kind: mapping.kind,
        url: verifyUrl(data.token_hash, mapping.type, data.redirect_to),
      }),
      kind: action,
    },
  ];
}

/**
 * Email-change is the one action that can produce two emails.
 *
 * Supabase's field naming here is reversed for backwards compatibility, and
 * getting it backwards silently sends each address the other's token:
 *   - `token_hash`     goes to the NEW address (with `token_new`)
 *   - `token_hash_new` goes to the CURRENT address (with `token`)
 * The second email only exists when Secure Email Change is on, which it is —
 * `supabase/config.toml` sets `double_confirm_changes = true`.
 */
function emailChangeEmails(
  { user, email_data: data }: AuthEmailPayload,
  locale: EmailLocale
): ResolvedAuthEmail[] {
  const emails: ResolvedAuthEmail[] = [];

  const newAddress = user.new_email ?? user.email;
  if (newAddress && data.token_hash) {
    emails.push({
      to: newAddress,
      message: authLinkEmail({
        locale,
        kind: 'email_change',
        url: verifyUrl(data.token_hash, 'email_change', data.redirect_to),
      }),
      kind: 'email_change_new',
    });
  }

  if (user.email && user.new_email && data.token_hash_new) {
    emails.push({
      to: user.email,
      message: authLinkEmail({
        locale,
        kind: 'email_change',
        url: verifyUrl(data.token_hash_new, 'email_change', data.redirect_to),
      }),
      kind: 'email_change_current',
    });
  }

  return emails;
}

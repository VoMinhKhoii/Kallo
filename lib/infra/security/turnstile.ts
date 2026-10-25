import 'server-only';

/**
 * Cloudflare Turnstile, checked by our own server.
 *
 * Every auth email costs money now (Cloudflare Email Sending bills past the
 * monthly allowance), so the requests that send one carry a Turnstile token
 * and the auth proxy checks it before Supabase is asked to send anything.
 * Supabase's own captcha setting stays OFF on purpose: it is all-or-nothing,
 * so turning it on would reject every iOS build already in the field, and it
 * would see this service's egress IP instead of the user's.
 *
 * Clients send the token in the field both Supabase SDKs already use for
 * captcha (`gotrue_meta_security.captcha_token`), so where it is checked can
 * move without an app update.
 */

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare normally answers in well under a second. Past this the request
 * is answered as "try again" rather than held open on a sign-in screen.
 */
const SITEVERIFY_TIMEOUT_MS = 3_000;

/**
 * How far enforcement has been rolled out (`TURNSTILE_MODE`):
 *
 * - `off`     — nothing is checked. Always the answer unless BOTH keys are
 *               set: a secret without a site key would refuse every code
 *               request, because no client could render the widget.
 * - `monitor` — tokens are checked and the result logged; nothing is refused.
 * - `codes`   — a sign-in code request (`/otp`, `/magiclink`) without a valid
 *               token is refused. Old iOS builds never send those.
 * - `all`     — sign-up, password reset and resend are refused too. Those are
 *               the paths only old iOS builds (and bots) still call.
 */
export type TurnstileMode = 'off' | 'monitor' | 'codes' | 'all';

const MODES: readonly TurnstileMode[] = ['off', 'monitor', 'codes', 'all'];

export function turnstileMode(): TurnstileMode {
  if (!process.env.TURNSTILE_SECRET_KEY || !turnstileSiteKey()) return 'off';
  const configured = process.env.TURNSTILE_MODE?.trim().toLowerCase();
  if (!configured) return 'monitor';
  if ((MODES as readonly string[]).includes(configured)) {
    return configured as TurnstileMode;
  }
  // A typo must not silently switch protection off, nor lock everyone out.
  console.error(`[turnstile] unknown TURNSTILE_MODE "${configured}"`);
  return 'monitor';
}

/**
 * The public site key the widgets render with, read at request time and
 * handed to the web dialog and the iOS widget page — never baked into a build.
 * Null when unset or blank (a missing Cloud Run variable leaves "").
 */
export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY?.trim() || null;
}

/** `unavailable` = Cloudflare could not be asked; the token may be fine. */
export type TurnstileOutcome = 'valid' | 'invalid' | 'unavailable';

/**
 * Ask Cloudflare whether a widget token is real. Tokens are single-use and
 * live for 300 s, so a client fetches a fresh one for every send.
 *
 * `remoteIp` is the user's own address (Cloudflare's `cf-connecting-ip`), which
 * is what Turnstile's scoring expects. Never throws.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null
): Promise<TurnstileOutcome> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return 'unavailable';

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set('remoteip', remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) return 'unavailable';
    const data = (await res.json()) as { success?: unknown };
    return data.success === true ? 'valid' : 'invalid';
  } catch (error) {
    console.error('[turnstile] siteverify failed', error);
    return 'unavailable';
  }
}

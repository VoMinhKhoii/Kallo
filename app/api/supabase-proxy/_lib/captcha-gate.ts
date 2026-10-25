import {
  type TurnstileMode,
  type TurnstileOutcome,
  turnstileMode,
  verifyTurnstileToken,
} from '@/lib/infra/security/turnstile';
import { readBodyField } from './auth-body';

/**
 * Which proxied auth requests must carry a Turnstile token, and at which
 * rollout stage (see `TurnstileMode`).
 *
 * Only requests that make Supabase SEND AN EMAIL are gated: that is where a
 * bot flood costs money. Verifying a code and the password grant are never
 * gated — the second is how iOS builds released before code sign-in still sign
 * people in, and both are already bounded per account by the limiter.
 */
const CODE_PATHS = new Set(['otp', 'magiclink']);
const LEGACY_EMAIL_PATHS = new Set(['signup', 'recover', 'resend']);

export interface CaptchaCheck {
  mode: TurnstileMode;
  /** Whether a missing or invalid token refuses the request. */
  enforced: boolean;
  /** The token the client sent, or null. */
  token: string | null;
  /** Upstream path, for the log line. */
  path: string;
}

/**
 * What this request owes, or `null` when it is not a gated path or the check
 * is off. Synchronous and network-free, so a request with no token is refused
 * before it costs a limiter round trip.
 */
export function captchaCheckFor(input: {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
}): CaptchaCheck | null {
  if (input.method.toUpperCase() !== 'POST') return null;
  const isCode = CODE_PATHS.has(input.path);
  if (!isCode && !LEGACY_EMAIL_PATHS.has(input.path)) return null;

  const mode = turnstileMode();
  if (mode === 'off') return null;

  return {
    mode,
    enforced: mode === 'all' || (mode === 'codes' && isCode),
    token: captchaToken(input.body),
    path: input.path,
  };
}

/**
 * The token, read where supabase-js and supabase-flutter put it:
 * `{"gotrue_meta_security": {"captcha_token": "…"}}`. A token is bounded
 * (Cloudflare's are ~2 KB at most) so a junk value never reaches siteverify.
 */
function captchaToken(
  body: Record<string, unknown> | undefined
): string | null {
  const meta = readBodyField(body, 'gotrue_meta_security');
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return null;
  }
  const token = readBodyField(meta as Record<string, unknown>, 'captcha_token');
  return typeof token === 'string' && token.length > 0 && token.length <= 4096
    ? token
    : null;
}

/** Checks the token with Cloudflare (when there is one) and logs the result. */
export async function verifyCaptcha(
  check: CaptchaCheck,
  request: Request,
  remoteIp: string | null
): Promise<TurnstileOutcome | 'missing'> {
  const outcome = check.token
    ? await verifyTurnstileToken(check.token, remoteIp)
    : 'missing';
  // One line per gated request is what tells the monitor stage apart from a
  // real rollout: how many requests arrive with a valid token, per client.
  console.info(
    `[turnstile] path=${check.path} mode=${check.mode} outcome=${outcome} client=${clientName(request)}`
  );
  return outcome;
}

/** `supabase-js-web/2.117.3` → `supabase-js-web`; never the raw header. */
function clientName(request: Request): string {
  const info = request.headers.get('x-client-info') ?? '';
  const name = info.split('/')[0]?.trim();
  return name && /^[a-z0-9._-]{1,40}$/i.test(name) ? name : 'unknown';
}

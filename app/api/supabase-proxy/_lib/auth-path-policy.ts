import { bearerSubjectKey, targetKeyFromBody } from './auth-target';

/**
 * What KIND of auth operation a proxied request is, and who it targets.
 *
 * The proxy forwards every `auth/v1/*` path GoTrue exposes, but those paths do
 * not deserve the same ceiling. Four classes:
 *
 *  - `email`   — anything that makes Supabase SEND A MESSAGE to an address the
 *                caller chose (signup, recover, otp, magiclink, resend, an
 *                email OR phone change on `/user`, and `/reauthenticate`). The
 *                abuse is mail-bombing a stranger, so the strict key is the
 *                RECIPIENT, not the sender.
 *  - `login`   — anything that tests a credential (password grant, `/verify`,
 *                the PKCE exchange, MFA challenge/verify). The abuse is
 *                brute-forcing one account from many addresses, so the strict
 *                key is the ACCOUNT being targeted.
 *  - `refresh` — the token refresh that keeps a signed-in user signed in. A
 *                storm here is a client bug, never an attack, and refusing it
 *                signs people out (see `enforce-limits.ts`).
 *  - `other`   — reads and everything unclassified: `GET /user`, `/logout`,
 *                `/settings`, `/authorize`, `/callback`, SSO. Bounded, cheap.
 *
 * Unknown paths land in `other` on purpose: a GoTrue endpoint we have not
 * enumerated should still be limited, just not with a policy that assumes
 * something false about it.
 */
export type AuthOpClass = 'email' | 'login' | 'refresh' | 'other';

export interface AuthRequestClass {
  op: AuthOpClass;
  /**
   * The thing the operation acts ON, as a limiter key value: a canonical email
   * address, `phone:<digits>`, or `user:<jwt sub>`. `null` when the request
   * names none, in which case only the global and IP budgets apply — unless
   * `requiresTarget` says the request may not proceed without one.
   */
  targetKey: string | null;
  /**
   * FAIL CLOSED when there is no `targetKey`.
   *
   * Set on the operations whose entire abuse story is the target: sending mail
   * to a stranger, and testing a password against an account. For those, "we
   * could not tell who this is aimed at" is not a request to forward on the
   * global budget alone — it is a request to refuse, because forwarding it is
   * exactly the unkeyed mail-bomb the recipient budget exists to stop.
   *
   * It is deliberately NOT set on `/verify` (a `token_hash` link names nobody),
   * `/reauthenticate` (the account is the bearer token, which may be absent or
   * unparseable), the PKCE/id_token grants, or MFA.
   */
  requiresTarget: boolean;
}

export interface ClassifyAuthRequestInput {
  method: string;
  /** Upstream pathname with `/auth/v1/` already stripped, e.g. `token`. */
  path: string;
  /** The `grant_type` query parameter, when the request carried one. */
  grantType: string | null;
  /** Parsed body — see `parseAuthBody`. */
  body: Record<string, unknown> | undefined;
  /** The `Authorization` header, for the ops whose target is the caller. */
  authorization: string | null;
}

/** Paths whose POST sends a message to an address the CALLER supplied. */
const EMAIL_PATHS = new Set([
  'signup',
  'recover',
  'otp',
  'magiclink',
  'resend',
]);

/** Paths that test a credential and so feed the brute-force controls. */
const LOGIN_PATHS = new Set(['verify']);

/**
 * MFA lives under `factors/<uuid>/challenge` and `factors/<uuid>/verify`, so
 * the id segment has to be skipped rather than matched.
 */
function isMfaChallenge(segments: string[]): boolean {
  return (
    segments[0] === 'factors' &&
    segments.length === 3 &&
    (segments[2] === 'verify' || segments[2] === 'challenge')
  );
}

const OTHER: AuthRequestClass = {
  op: 'other',
  targetKey: null,
  requiresTarget: false,
};

export function classifyAuthRequest(
  input: ClassifyAuthRequestInput
): AuthRequestClass {
  const method = input.method.toUpperCase();
  const segments = input.path.split('/').filter(Boolean);
  const head = segments[0] ?? '';
  const target = targetKeyFromBody(input.body);

  // /reauthenticate SENDS MAIL (or an SMS): it is GoTrue's "confirm it is you
  // before changing a password" nonce. GoTrue routes it on GET *and* POST, and
  // classifying only the POST let the GET spelling mail a user's inbox on the
  // cheap `other` budget. The body names nobody, so the account is the bearer
  // token's subject; with no usable token it falls back to IP + global rather
  // than refusing, because a 400 here would break a real signed-in flow.
  if (head === 'reauthenticate' && segments.length === 1) {
    return {
      op: 'email',
      targetKey: bearerSubjectKey(input.authorization),
      requiresTarget: false,
    };
  }

  // An email change is a PUT/POST on /user carrying a new address — the same
  // mail-bombing primitive as /recover, just spelled differently. A `phone`
  // change is the same primitive over SMS: `[auth.sms] enable_signup = false`
  // in supabase/config.toml means nothing is sent TODAY, and the day it is
  // enabled this classification is what stops the SMS bill. A /user request
  // naming neither is a profile update and stays `other`.
  if (head === 'user' && segments.length === 1) {
    if ((method === 'PUT' || method === 'POST') && target) {
      return { op: 'email', targetKey: target, requiresTarget: true };
    }
    return OTHER;
  }

  if (method !== 'POST') return OTHER;

  if (EMAIL_PATHS.has(head) && segments.length === 1) {
    return { op: 'email', targetKey: target, requiresTarget: true };
  }

  if (head === 'token' && segments.length === 1) {
    if (input.grantType === 'refresh_token') {
      return { op: 'refresh', targetKey: null, requiresTarget: false };
    }
    // An unknown or missing grant_type is still a token mint — treat it as a
    // credential test rather than letting an attacker pick the cheap bucket by
    // omitting a query parameter. Only the password grant fails closed on a
    // missing target: pkce and id_token legitimately name no account.
    return {
      op: 'login',
      targetKey: target,
      requiresTarget: input.grantType === 'password',
    };
  }

  if (
    (LOGIN_PATHS.has(head) && segments.length === 1) ||
    isMfaChallenge(segments)
  ) {
    return { op: 'login', targetKey: target, requiresTarget: false };
  }

  return OTHER;
}

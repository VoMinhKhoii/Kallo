// ---------------------------------------------------------------------------
// Sign in with Apple — REST token exchange and revocation
// ---------------------------------------------------------------------------
// Apple's account-deletion guidance: an app that offers Sign in with Apple must
// revoke the user's tokens when the account is deleted. Revocation needs a
// refresh token, and the only way to get one is to exchange the single-use,
// five-minute authorization code the native sheet returns. So the iOS client
// posts that code right after sign-in, we exchange it here, and the deletion
// job revokes the resulting refresh token later.
//
// Neither call ever throws: sign-in must not fail because of this, and the
// deletion job needs a verdict it can turn into "retry" rather than a crash.

import 'server-only';
import { z } from 'zod';
import { APPLE_AUDIENCE, createAppleClientSecret } from './client-secret';
import { type AppleAuthConfig, readAppleAuthConfig } from './config';

const REQUEST_TIMEOUT_MS = 10_000;

export type AppleAuthFailure =
  /** Env unset or the .p8 unusable — a deploy fact, logged once per call. */
  | 'not_configured'
  /** Apple refused the code or token (expired, reused, wrong client). */
  | 'invalid_grant'
  | 'timeout'
  | 'upstream_error';

export type AppleExchangeResult =
  | { ok: true; refreshToken: string; subject: string | null }
  | { ok: false; reason: AppleAuthFailure };

export type AppleRevokeResult =
  | { ok: true }
  | { ok: false; reason: Exclude<AppleAuthFailure, 'invalid_grant'> };

export interface AppleAuthDeps {
  fetch?: typeof fetch;
  config?: AppleAuthConfig | null;
  now?: number;
}

const tokenResponseSchema = z.object({
  refresh_token: z.string().min(1),
  id_token: z.string().optional(),
});
const idTokenClaimsSchema = z.object({ sub: z.string().min(1) });
const errorResponseSchema = z.object({ error: z.string() });

type Credentials = { clientId: string; clientSecret: string };

function credentials(deps: AppleAuthDeps): Credentials | null {
  const config =
    deps.config === undefined ? readAppleAuthConfig() : deps.config;
  if (!config) {
    console.warn('[apple-auth] Sign in with Apple REST is not configured');
    return null;
  }
  try {
    return {
      clientId: config.clientId,
      clientSecret: createAppleClientSecret(config, deps.now),
    };
  } catch (error) {
    console.error('[apple-auth] APPLE_SIGNIN_KEY_P8 is unusable', error);
    return null;
  }
}

/** The `sub` of an id_token Apple just handed us over TLS (no re-verify). */
function subjectOf(idToken: string | undefined): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    const claims = idTokenClaimsSchema.safeParse(
      JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    );
    return claims.success ? claims.data.sub : null;
  } catch {
    return null;
  }
}

async function postForm(
  path: '/auth/token' | '/auth/revoke',
  form: Record<string, string>,
  deps: AppleAuthDeps
): Promise<Response | 'timeout' | 'upstream_error'> {
  try {
    return await (deps.fetch ?? fetch)(`${APPLE_AUDIENCE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // `AbortSignal.timeout` rejects with a DOMException, which is not an
    // `Error` subclass in every runtime — read the name structurally.
    const name = (error as { name?: unknown } | null)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
    console.error(`[apple-auth] ${path} request failed`, error);
    return 'upstream_error';
  }
}

async function errorCode(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success ? parsed.data.error : `http_${response.status}`;
}

/** Exchange a native authorization code for a refresh token. */
export async function exchangeAppleAuthorizationCode(
  code: string,
  deps: AppleAuthDeps = {}
): Promise<AppleExchangeResult> {
  const creds = credentials(deps);
  if (!creds) return { ok: false, reason: 'not_configured' };
  const response = await postForm(
    '/auth/token',
    {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      grant_type: 'authorization_code',
    },
    deps
  );
  if (typeof response === 'string') return { ok: false, reason: response };
  if (!response.ok) {
    const error = await errorCode(response);
    console.error(`[apple-auth] /auth/token refused (${error})`);
    return {
      ok: false,
      reason: error === 'invalid_grant' ? 'invalid_grant' : 'upstream_error',
    };
  }
  const parsed = tokenResponseSchema.safeParse(
    await response.json().catch(() => null)
  );
  if (!parsed.success) return { ok: false, reason: 'upstream_error' };
  return {
    ok: true,
    refreshToken: parsed.data.refresh_token,
    subject: subjectOf(parsed.data.id_token),
  };
}

/**
 * Revoke a refresh token. Idempotent: Apple answers 200 for a token that is
 * already revoked, and an `invalid_grant` refusal means the token can no
 * longer be used either — both are success, so a retried deletion job cannot
 * get stuck on a token that is already dead.
 */
export async function revokeAppleRefreshToken(
  refreshToken: string,
  deps: AppleAuthDeps = {}
): Promise<AppleRevokeResult> {
  const creds = credentials(deps);
  if (!creds) return { ok: false, reason: 'not_configured' };
  const response = await postForm(
    '/auth/revoke',
    {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    },
    deps
  );
  if (typeof response === 'string') return { ok: false, reason: response };
  if (response.ok) return { ok: true };
  const error = await errorCode(response);
  if (error === 'invalid_grant') return { ok: true };
  console.error(`[apple-auth] /auth/revoke refused (${error})`);
  return { ok: false, reason: 'upstream_error' };
}

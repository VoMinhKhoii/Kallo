import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';
import type { AuthRequestClass } from './auth-path-policy';

/**
 * Apply the caller's own IP policy before captcha and shared budgets.
 *
 * Every class carries an app-wide budget except `other` — a botnet spread
 * across a million addresses looks unremarkable on every per-client key and is
 * only visible in the total.
 *
 * Two rules shape the guards below:
 *
 *  - **A policy is never applied with zero keys.** `getRequestIp` returns
 *    `null` in production whenever `cf-connecting-ip` is absent, and a body
 *    need not name an address. Calling `assertRateLimit('authEmailIp', …)`
 *    with nothing to key on resolves no key, which the limiter treats as
 *    misuse (it throws outside production and admits-with-telemetry inside
 *    it). So each per-client policy is guarded on the value existing.
 *  - **A null IP is not unlimited.** `enforceSharedLimits` still runs.
 *
 * `authOther` is an IP-only memory policy, so with no IP there is genuinely
 * nothing to enforce and nothing to fall back to; the request is admitted.
 * That is deliberate: it is the cheapest class we have.
 *
 * Every key value this consumes is HMAC'd under `ANALYSIS_GUARD_HASH_SECRET`
 * before it reaches the database — the auth path HARD-DEPENDS on that secret
 * being present (bound in `.github/workflows/cloud-run-prod.yml` via
 * `--set-secrets`); without it `hashRateLimitKey` throws and every guarded auth
 * request 500s.
 *
 * NOTE ON SHARED EGRESS: we do NOT forward `X-Forwarded-For` upstream.
 * Supabase only honours a caller-supplied client IP (`Sb-Forwarded-For`) when
 * it is presented with a secret API key this layer does not hold, so every
 * proxied user already shares one bucket in Supabase's own per-IP auth limits —
 * this service's Cloud Run egress address. Those upstream limits, not
 * `authGlobal`, are the app's real auth ceiling; see docs/RATE_LIMITING.md.
 */
export async function enforceSourceLimits(
  request: Request,
  { op }: AuthRequestClass
): Promise<void> {
  const ip = getRequestIp(request);
  if (!ip) return;

  if (op === 'refresh') {
    await assertRateLimit('authRefresh', { kind: 'ip', value: ip });
    return;
  }

  if (op === 'other') {
    await assertRateLimit('authOther', { kind: 'ip', value: ip });
    return;
  }

  await assertRateLimit(op === 'email' ? 'authEmailIp' : 'authLoginIp', {
    kind: 'ip',
    value: ip,
  });
}

/** Charge shared budgets only after source limits and captcha admit the request. */
export async function enforceSharedLimits({
  op,
  targetKey,
}: AuthRequestClass): Promise<void> {
  if (op === 'other') return;
  if (op === 'refresh') {
    await assertRateLimit('authRefreshGlobal', {
      kind: 'global',
      value: 'auth:refresh',
    });
    return;
  }

  await assertRateLimit('authGlobal', { kind: 'global', value: 'auth' });

  if (op === 'email') {
    if (targetKey) {
      await assertRateLimit('authEmailRecipient', {
        kind: 'recipient',
        value: targetKey,
      });
    }
    return;
  }

  if (targetKey) {
    await assertRateLimit('authLoginAccount', {
      kind: 'account',
      value: targetKey,
    });
  }
}

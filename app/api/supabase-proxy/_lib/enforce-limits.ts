import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';
import type { AuthRequestClass } from './auth-path-policy';

/**
 * Apply the policies a classified auth request earns, cheapest key first.
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
 *  - **A null IP is not unlimited.** The global budget still ran.
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
export async function enforceAuthProxyLimits(
  request: Request,
  classification: AuthRequestClass
): Promise<void> {
  const ip = getRequestIp(request);
  const { op, targetKey } = classification;

  // Refresh runs its own global budget BEFORE the per-IP bucket: the IP one is
  // a memory flood breaker sized for CGNAT, so a botnet refreshing stolen
  // tokens from a million addresses is invisible to it and visible only here.
  // This is the one place refresh pays a database round trip, and it is worth
  // it precisely because nothing else can see that shape.
  if (op === 'refresh') {
    await assertRateLimit('authRefreshGlobal', {
      kind: 'global',
      value: 'auth:refresh',
    });
    if (ip) await assertRateLimit('authRefresh', { kind: 'ip', value: ip });
    return;
  }

  if (op === 'other') {
    if (!ip) return;
    await assertRateLimit('authOther', { kind: 'ip', value: ip });
    return;
  }

  await assertRateLimit('authGlobal', { kind: 'global', value: 'auth' });

  if (op === 'email') {
    if (ip) await assertRateLimit('authEmailIp', { kind: 'ip', value: ip });
    if (targetKey) {
      await assertRateLimit('authEmailRecipient', {
        kind: 'recipient',
        value: targetKey,
      });
    }
    return;
  }

  if (ip) await assertRateLimit('authLoginIp', { kind: 'ip', value: ip });
  if (targetKey) {
    await assertRateLimit('authLoginAccount', {
      kind: 'account',
      value: targetKey,
    });
  }
}

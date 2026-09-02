import { isIP } from 'node:net';

/**
 * The client's IP, as a value we are willing to rate-limit on.
 *
 * `x-forwarded-for` is client-writable. Anything that can open a socket to the
 * origin can send `X-Forwarded-For: <anything>`, and a limiter keyed on that
 * header is not a limiter — it is a per-request-header counter the attacker
 * chooses the key for. That is the whole reason this function distinguishes
 * two modes:
 *
 *  - **Production** (`ORIGIN_SHARED_SECRET` set ⇒ the origin lock in
 *    `middleware.ts` is active ⇒ traffic reaches us through Cloudflare):
 *    `cf-connecting-ip` ONLY. Cloudflare strips and re-writes that header on
 *    every proxied request, so it cannot be forged from outside. If it is
 *    absent, the answer is `null` — never a fallback to XFF, because a request
 *    that arrives without it did not come through Cloudflare, which is exactly
 *    the request whose self-reported IP we must not believe.
 *  - **Non-production** (no origin lock): `x-forwarded-for[0]` then
 *    `x-real-ip`, so local dev and preview environments behind an arbitrary
 *    proxy still get a usable value.
 *
 * `null` means "no IP key available", NOT "unlimited". Callers fall through to
 * their remaining keys — in practice an app-wide global budget still applies.
 */
export function getRequestIp(request: Request): string | null {
  if (process.env.ORIGIN_SHARED_SECRET) {
    return canonicalizeIp(request.headers.get('cf-connecting-ip'));
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = canonicalizeIp(forwardedFor?.split(',')[0]);

  return forwardedIp ?? canonicalizeIp(request.headers.get('x-real-ip'));
}

/**
 * Validate and normalize, so a header carrying a port, brackets, an IPv6 zone
 * id, or plain garbage never becomes a counter key of its own.
 */
function canonicalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  // `[2001:db8::1]` / `[2001:db8::1]:443` — brackets and port are envelope.
  const bracketed = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/);
  // A scope id (`fe80::1%eth0`) is local to the sender's host, never routable.
  const host = (bracketed ? bracketed[1] : trimmed).split('%')[0];
  // `198.51.100.4:5432`. Only ever an IPv4 form — a bare IPv6 has many colons,
  // and a bracketed one was already unwrapped above.
  const withoutPort =
    isIP(host) === 0 && host.split(':').length === 2
      ? host.split(':')[0]
      : host;

  if (isIP(withoutPort) === 0) return null;

  return withoutPort.toLowerCase();
}

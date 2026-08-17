/**
 * The client's IP as seen through the reverse proxies in front of the app
 * (Cloudflare → Cloud Run), for rate limiting.
 *
 * The first entry of `x-forwarded-for` is the original client; everything after
 * it is proxy hops. `x-real-ip` is the fallback for setups that only send that.
 * Treat the result as an untrusted hint — it is spoofable by anything that can
 * reach the origin directly, which is precisely what the origin-lock in
 * `middleware.ts` is there to prevent.
 */
export function getRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const forwardedIp = forwardedFor?.split(',')[0]?.trim();

  return forwardedIp || request.headers.get('x-real-ip');
}

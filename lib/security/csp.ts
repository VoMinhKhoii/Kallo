/**
 * Content-Security-Policy for the web app.
 *
 * Strategy: a strict, nonce-based policy. `script-src` trusts only `'self'` +
 * the per-request `'nonce-…'` and uses `'strict-dynamic'`, so an injected
 * `<script>` (stored XSS, malicious dependency) is refused even though the user
 * is authenticated — that is the control that stops an attacker from silently
 * calling `linkIdentity` to plant a persistent backdoor login.
 *
 * Rollout: shipped as `Content-Security-Policy-Report-Only` first (see
 * `middleware.ts`). Report-Only blocks nothing and keeps static rendering, so
 * there is zero white-screen risk; the browser just reports what *would* break.
 *
 * To ENFORCE later: (1) change the response header name from
 * `content-security-policy-report-only` to `content-security-policy`, and
 * (2) force dynamic rendering app-wide — statically pre-rendered pages bake
 * their inline framework scripts at build time with no request-time nonce, so
 * under an enforced strict `script-src` they would be blocked. Nonce + static
 * generation are mutually exclusive (a documented Next.js constraint).
 *
 * Third-party origins are intentionally tiny: the only external service the
 * browser talks to is Supabase (auth/REST over https + realtime over wss), and
 * fonts are self-hosted by `next/font`. `style-src` keeps `'unsafe-inline'`
 * because `next/font` and assorted libraries inject inline `style` attributes,
 * which cannot carry a nonce; inline *style* injection is not an XSS vector.
 */

function supabaseOrigins(): { https: string; wss: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const { origin } = new URL(url);
    return { https: origin, wss: origin.replace(/^https:/, 'wss:') };
  } catch {
    return null;
  }
}

/**
 * Build the CSP header value for a request, embedding the per-request `nonce`.
 * `isDev` adds `'unsafe-eval'` (Next.js dev/HMR needs eval) — never in prod.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const supabase = supabaseOrigins();
  const connect = ["'self'", supabase?.https, supabase?.wss]
    .filter(Boolean)
    .join(' ');
  const img = ["'self'", 'data:', 'blob:', supabase?.https]
    .filter(Boolean)
    .join(' ');

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${img}`,
    `font-src 'self'`,
    `connect-src ${connect}`,
    `manifest-src 'self'`,
    `worker-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

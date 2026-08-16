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
 * Third-party origins are intentionally tiny: the browser talks to Supabase
 * (auth/REST over https + realtime over wss), to Google Identity Services on
 * the auth dialog, and, on the paywall only, to RevenueCat and Paddle. Fonts
 * are self-hosted by `next/font`. `style-src`
 * keeps `'unsafe-inline'` because `next/font` and assorted libraries inject
 * inline `style` attributes, which cannot carry a nonce; inline *style*
 * injection is not an XSS vector.
 */

/**
 * Web checkout origins. RevenueCat is the subscription brain; Paddle is the
 * billing engine and merchant of record, and its checkout renders as an iframe
 * inside our page (see docs/BILLING.md).
 *
 * Paddle publishes no canonical CSP allowlist, so `*.paddle.com` covers the
 * environment-specific checkout hosts (`buy.` in production, `sandbox-buy.` in
 * sandbox) rather than guessing at subdomains. Narrow this to the exact hosts
 * once a sandbox checkout has been run and the Report-Only violations name
 * them.
 *
 * Deliberately absent from `script-src`: Paddle.js is served from
 * `cdn.paddle.com`, but `'strict-dynamic'` makes host allowlists inert for
 * scripts, and the RevenueCat bundle that injects it already carries the
 * request nonce. Adding the host there would be dead configuration.
 */
const BILLING_FRAME_ORIGINS = ['https://*.paddle.com', 'https://pay.rev.cat'];
const BILLING_CONNECT_ORIGINS = [
  'https://api.revenuecat.com',
  'https://*.paddle.com',
];

/**
 * Google Identity Services, which mints the ID token for web Google sign-in on
 * our own origin (`hooks/auth/use-google-identity.ts`). GIS renders its button
 * inside an `accounts.google.com` iframe and calls back to the same origin, so
 * it needs both `frame-src` and `connect-src`; the account picker itself is a
 * popup window, which CSP does not govern.
 *
 * Not in `script-src` for the same reason Paddle isn't: `'strict-dynamic'`
 * makes host allowlists inert there, and our own nonced bundle is what injects
 * the GIS `<script>`.
 */
const GOOGLE_IDENTITY_ORIGIN = 'https://accounts.google.com';
/** Avatars on the personalized button / One Tap card. */
const GOOGLE_AVATAR_ORIGIN = 'https://*.googleusercontent.com';

function supabaseOrigins(): { https: string; wss: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const { origin } = new URL(url);
    // Realtime is wss over https and ws over http (local `supabase start`).
    const ws = origin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    return { https: origin, wss: ws };
  } catch {
    return null;
  }
}

/**
 * Build the CSP header value for a request, embedding the per-request `nonce`.
 * `isDev` adds `'unsafe-eval'` (Next.js dev/HMR needs eval) — never in prod.
 *
 * `reportOnly` drops `upgrade-insecure-requests`. That directive is defined to
 * be ignored in a report-only policy, and Chrome logs an error saying so on
 * every page load — which is a real console error users and audits see, for a
 * directive that was doing nothing. It comes back automatically on the day the
 * header is switched to enforcing (see the rollout note above). Nothing is lost
 * meanwhile: the origin is HTTPS-only behind HSTS, so there is no insecure
 * request left to upgrade.
 */
export function buildCsp(
  nonce: string,
  isDev: boolean,
  reportOnly = false
): string {
  const supabase = supabaseOrigins();
  const connect = [
    "'self'",
    supabase?.https,
    supabase?.wss,
    ...BILLING_CONNECT_ORIGINS,
    GOOGLE_IDENTITY_ORIGIN,
  ]
    .filter(Boolean)
    .join(' ');
  const img = [
    "'self'",
    'data:',
    'blob:',
    supabase?.https,
    GOOGLE_AVATAR_ORIGIN,
  ]
    .filter(Boolean)
    .join(' ');

  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${img}`,
    `font-src 'self'`,
    `connect-src ${connect}`,
    `frame-src 'self' ${BILLING_FRAME_ORIGINS.join(' ')} ${GOOGLE_IDENTITY_ORIGIN}`,
    `manifest-src 'self'`,
    `worker-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(reportOnly ? [] : [`upgrade-insecure-requests`]),
  ].join('; ');
}

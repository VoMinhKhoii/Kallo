/**
 * Content-Security-Policy for the web app — ENFORCED, and deliberately
 * nonce-free.
 *
 * Why no nonce. Cache Components (`next.config.ts`) prerenders a static shell
 * for every route at build time, and Partial Prefetching reuses it across
 * navigations — that is what makes navigation instant. A nonce is a per-request
 * secret, and a shell baked at build time cannot carry one: Next documents
 * nonces as requiring dynamic rendering and as incompatible with prerendered
 * shells. Measured against the production build: the shell's framework chunks
 * and its inline bootstrap script carry no nonce, so a strict
 * `'nonce-…' 'strict-dynamic'` policy refuses every one of them (310 report-only
 * violations across 12 ordinary page views, all first-party).
 *
 * Why not hashes (`experimental.sri`). SRI puts `integrity` on the bootstrap
 * chunks only — in the build, 8 of the 24 `<script src>` tags on `/en`; the
 * client-component chunks React inserts have none — and the inline
 * `self.__next_f.push(…)` scripts carry the page's RSC payload, which differs
 * per request on every route with a dynamic hole. There is no fixed hash list
 * to put in a static header.
 *
 * So `script-src` allows `'unsafe-inline'`. Be clear about what that costs: it
 * does NOT stop an injected inline `<script>` or `on*=` handler from running.
 * What the policy still does, and what an XSS payload usually needs:
 *  - `connect-src` / `img-src` / `frame-src` allowlists — a script cannot
 *    `fetch`, beacon or pixel stolen data to an attacker's host;
 *  - `script-src` host list — no `<script src>` from an attacker's host, so a
 *    payload has to fit in the injection point;
 *  - `object-src 'none'`, `base-uri 'self'` — no plugin content, no `<base>`
 *    hijack that re-points every relative script URL;
 *  - `form-action 'self'` — no injected form posting credentials elsewhere;
 *  - `frame-ancestors 'none'` — no clickjacking (with `X-Frame-Options`).
 *
 * To tighten later: render the authenticated app dynamically (`await
 * connection()` above the app layout) and give THOSE routes a per-request
 * nonce policy from `proxy.ts`, keeping this policy for the static marketing
 * and docs pages. That trades instant navigation inside the app for a
 * `script-src` without `'unsafe-inline'`.
 *
 * Set once, statically, in `next.config.ts` `headers()`: that is the only
 * place that also covers prerendered responses and everything outside the
 * proxy matcher. Violations are reported to `CSP_REPORT_PATH`.
 *
 * `style-src` keeps `'unsafe-inline'` because `next/font`, Radix and the
 * RevenueCat purchase UI inject inline styles; inline *style* is not a script
 * execution vector.
 */

/** Same-origin collector for violation reports (`app/api/csp-report`). */
export const CSP_REPORT_PATH = '/api/csp-report';
/** The `Reporting-Endpoints` group name `report-to` refers to. */
export const CSP_REPORT_GROUP = 'csp-endpoint';

/**
 * Web checkout. RevenueCat is the subscription brain; Paddle is the billing
 * engine and merchant of record (docs/BILLING.md). `@revenuecat/purchases-js`
 * injects Paddle.js from `cdn.paddle.com`, posts SDK events to `e.revenue.cat`,
 * loads paywall images/fonts from its CloudFront asset host, and Paddle renders
 * its checkout in a `*.paddle.com` iframe (`buy.` in production,
 * `sandbox-buy.` in sandbox). Paddle publishes no canonical allowlist; narrow
 * the wildcard once a sandbox checkout's reports name the exact hosts.
 */
const PADDLE_CDN = 'https://cdn.paddle.com';
const PADDLE_HOSTS = 'https://*.paddle.com';
const REVENUECAT_ASSETS = 'https://da08ctfrofx1b.cloudfront.net';
const BILLING_FRAME_ORIGINS = [PADDLE_HOSTS, 'https://pay.rev.cat'];
const BILLING_CONNECT_ORIGINS = [
  'https://api.revenuecat.com',
  'https://e.revenue.cat',
  PADDLE_HOSTS,
];

/**
 * Google Identity Services, which mints the ID token for web Google sign-in
 * (`lib/infra/auth/google-identity.ts`). The script and stylesheet are pinned
 * to the exact paths Google documents; the button iframe and its callbacks
 * need the origin in `frame-src` and `connect-src`. The account picker is a
 * popup window, which CSP does not govern.
 */
const GOOGLE_IDENTITY_ORIGIN = 'https://accounts.google.com';
const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_IDENTITY_STYLE = 'https://accounts.google.com/gsi/style';
/** Avatars on the personalized button / One Tap card. */
const GOOGLE_AVATAR_ORIGIN = 'https://*.googleusercontent.com';

/**
 * Error reporting (Sentry, US region) and product analytics (PostHog, EU
 * cloud) — see `lib/infra/telemetry/monitoring/` and `lib/infra/telemetry/analytics/`. Sentry's US
 * DSNs name a per-organisation `o<id>.ingest.us.sentry.io` host, hence the
 * wildcard. PostHog sends events to `eu.i` and fetches its remote config from
 * `eu-assets.i`. Browser → these hosts only; no script is loaded from them
 * (both SDKs are bundled).
 */
const MONITORING_CONNECT_ORIGINS = [
  'https://*.ingest.us.sentry.io',
  'https://eu.i.posthog.com',
  'https://eu-assets.i.posthog.com',
];

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

function sources(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/**
 * The enforced policy. `isDev` adds `'unsafe-eval'` (React's dev build uses
 * eval to rebuild server error stacks) — never in production.
 *
 * Read at `next build` (headers are compiled into the routes manifest), so the
 * Supabase origin is the build-time `NEXT_PUBLIC_SUPABASE_URL` — the same value
 * the client bundle inlines, which the Dockerfile passes as a build arg.
 */
export function buildCsp(isDev: boolean): string {
  const supabase = supabaseOrigins();

  return [
    `default-src 'self'`,
    `script-src ${sources("'self'", "'unsafe-inline'", isDev && "'unsafe-eval'", GOOGLE_IDENTITY_SCRIPT, PADDLE_CDN)}`,
    `style-src ${sources("'self'", "'unsafe-inline'", GOOGLE_IDENTITY_STYLE, PADDLE_CDN)}`,
    `img-src ${sources("'self'", 'data:', 'blob:', supabase?.https, GOOGLE_AVATAR_ORIGIN, REVENUECAT_ASSETS)}`,
    `font-src ${sources("'self'", REVENUECAT_ASSETS)}`,
    `connect-src ${sources("'self'", supabase?.https, supabase?.wss, ...BILLING_CONNECT_ORIGINS, GOOGLE_IDENTITY_ORIGIN, ...MONITORING_CONNECT_ORIGINS)}`,
    `frame-src ${sources("'self'", ...BILLING_FRAME_ORIGINS, GOOGLE_IDENTITY_ORIGIN)}`,
    `manifest-src 'self'`,
    `worker-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
    // `report-to` is the current mechanism; browsers that support it ignore
    // `report-uri` when both are present, and the rest fall back to it.
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join('; ');
}

/**
 * The CSP plus the `Reporting-Endpoints` header its `report-to` names, in the
 * shape `next.config.ts` `headers()` takes. A relative endpoint URL is
 * resolved against the document, so the same header works on every host the
 * app is served from.
 */
export function cspHeaders(isDev: boolean): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(isDev) },
    {
      key: 'Reporting-Endpoints',
      value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
    },
  ];
}

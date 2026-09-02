import type { RateLimitPolicy } from './types';

/**
 * The policy registry. DATA ONLY — no branching, no env reads.
 *
 * Limits live here rather than at the call sites so that "what is this route's
 * ceiling, and what happens when the limiter breaks" is one table you can read
 * top to bottom, and so a new call site cannot invent its own failure
 * semantics. Constants rather than env overrides on purpose: a limit that can
 * be changed by an environment variable is a limit nobody can reason about
 * from the code, and every one of these was chosen against a specific abuse.
 *
 * Shape of the numbers:
 *  - IP limits are deliberately GENEROUS. CGNAT, campus NAT and corporate
 *    egress put thousands of unrelated people behind one address; a tight IP
 *    limit locks a university out long before it inconveniences an attacker
 *    with a botnet.
 *  - `account` / `recipient` limits are the strict ones. They are keyed on the
 *    thing being attacked (the mailbox being bombed, the account being
 *    brute-forced), so they cannot be escaped by rotating source addresses.
 *  - `global` budgets are the botnet backstop: they cap total spend even when
 *    no individual key looks abusive.
 *  - `failMode: 'memory'` policies carry a `perMinute` and NOTHING else. The
 *    per-instance bucket is a rate, not a quota, so an hour or day number on
 *    one would be unenforceable — the type refuses it.
 */
export const rateLimitPolicies = {
  // ---------------------------------------------------------------------
  // Supabase auth proxy (wired in PR 2)
  // ---------------------------------------------------------------------

  /** signup / recover / otp / resend / email-change, keyed on source IP. */
  authEmailIp: {
    route: 'auth:email:ip',
    limits: { perMinute: 10, perHour: 30, perDay: 100 },
    keyKinds: ['ip'],
    failMode: 'degraded',
  },

  /**
   * The same operations keyed on the TARGET mailbox. This is the mail-bombing
   * control: rotating IPs does not change who receives the mail.
   */
  authEmailRecipient: {
    route: 'auth:email:recipient',
    limits: { perMinute: 2, perHour: 6, perDay: 20 },
    keyKinds: ['recipient'],
    failMode: 'degraded',
  },

  /** Password grant / verify / MFA, keyed on source IP. */
  authLoginIp: {
    route: 'auth:login:ip',
    limits: { perMinute: 30, perHour: 300, perDay: 1000 },
    keyKinds: ['ip'],
    failMode: 'degraded',
  },

  /** Password grant keyed on the account under attack — the brute-force cap. */
  authLoginAccount: {
    route: 'auth:login:account',
    limits: { perMinute: 10, perHour: 30, perDay: 100 },
    keyKinds: ['account'],
    failMode: 'degraded',
  },

  /**
   * Every proxied `email` / `login` operation, app-wide — a BOTNET BACKSTOP,
   * not a fairness mechanism and not an upstream-shaped budget.
   *
   * It would be comfortable to claim this is sized against GoTrue's own limits
   * so we shed before Supabase does. It is not, and it cannot be: every
   * proxied user reaches Supabase through this service's single Cloud Run
   * egress address, and `Sb-Forwarded-For` (the only way to tell Supabase who
   * the real caller is) requires a secret key this layer does not hold. So
   * Supabase's PER-IP auth limits — `sign_in_sign_ups` 30 / 5 min,
   * `token_verifications` 30 / 5 min, `token_refresh` 150 / 5 min per
   * supabase/config.toml, plus whatever the hosted dashboard is set to — apply
   * to ALL of our users together and are the app's real auth ceiling. This
   * number only caps total spend when no individual key looks abusive. See
   * docs/RATE_LIMITING.md and the ops action in docs/PROD_DOMAIN_SETUP.md.
   */
  authGlobal: {
    route: 'auth:global',
    limits: { perMinute: 300, perHour: 3000 },
    keyKinds: ['global'],
    failMode: 'degraded',
  },

  /**
   * Token refresh, per source IP. A FLOOD BREAKER, NOT A QUOTA.
   *
   * Deliberately loose (600/min per instance). One CGNAT or carrier-NAT
   * address fronts thousands of unrelated phones, each refreshing on its own
   * schedule and each retrying after a network blip, so a tight number here
   * refuses real sessions long before it inconveniences anyone. And a refusal
   * on this path is not a delay — it is a SIGN-OUT unless it is spoken as a
   * retryable status (see `_lib/guard-auth-request.ts`). The control that
   * actually bounds a distributed refresh flood is `authRefreshGlobal`.
   *
   * `perMinute` only — see the `memory` arm of `RateLimitPolicy`. An hourly
   * number here would be a ceiling nothing enforces.
   */
  authRefresh: {
    route: 'auth:refresh',
    limits: { perMinute: 600 },
    keyKinds: ['ip'],
    failMode: 'memory',
  },

  /**
   * Refresh, app-wide — the only thing that can see a botnet replaying stolen
   * refresh tokens from a million addresses, each of which looks like one
   * ordinary phone to `authRefresh`.
   *
   * It costs one database round trip on the path that keeps every signed-in
   * user signed in, which the memory-only design of `authRefresh` exists to
   * avoid. That is the accepted trade: one shared counter row, `degraded` so a
   * limiter outage never blocks refresh, and sized (3000/min ≈ 50/s) far above
   * anything the real fleet produces so it only ever fires on an attack.
   */
  authRefreshGlobal: {
    route: 'auth:refresh:global',
    limits: { perMinute: 3000, perHour: 60000 },
    keyKinds: ['global'],
    failMode: 'degraded',
  },

  authOther: {
    route: 'auth:other',
    limits: { perMinute: 60 },
    keyKinds: ['ip'],
    failMode: 'memory',
  },

  /**
   * The emailed-link and OAuth-callback legs (`/auth/verify`, `/auth/callback`).
   *
   * Both are anonymous browser navigations that call GoTrue directly —
   * `verifyOtp` and `exchangeCodeForSession` — from this service's single Cloud
   * Run egress address, so an unbounded flood of guessed `token_hash` /`code`
   * values spends the app's SHARED `token_verifications` budget upstream. They
   * are not proxied, so the auth-proxy policies never saw them.
   *
   * Generous, like every IP policy, and `degraded`: a limiter outage must not
   * strand people mid signup-confirmation.
   */
  authLinkIp: {
    route: 'auth:link:ip',
    limits: { perMinute: 20, perHour: 100 },
    keyKinds: ['ip'],
    failMode: 'degraded',
  },

  // ---------------------------------------------------------------------
  // Public, unauthenticated surfaces (wired in PR 2)
  // ---------------------------------------------------------------------

  /** Waitlist signup sends mail; treat it like an auth email op. */
  waitlistSignupIp: {
    route: 'waitlist:signup:ip',
    limits: { perMinute: 5, perHour: 20, perDay: 50 },
    keyKinds: ['ip'],
    failMode: 'degraded',
  },

  waitlistConfirmIp: {
    route: 'waitlist:confirm:ip',
    limits: { perMinute: 20, perHour: 100 },
    keyKinds: ['ip'],
    failMode: 'degraded',
  },

  /**
   * Memory-only by necessity: healthz is what the deploy smoke gate and the
   * uptime probes call, so it must answer even when the database is the thing
   * that is broken.
   */
  healthzIp: {
    route: 'healthz:ip',
    limits: { perMinute: 30 },
    keyKinds: ['ip'],
    failMode: 'memory',
  },

  /** Invite lookup is a cheap read behind an unguessable token. */
  inviteLookupIp: {
    route: 'invite:lookup:ip',
    limits: { perMinute: 30 },
    keyKinds: ['ip'],
    failMode: 'memory',
  },

  // ---------------------------------------------------------------------
  // Authenticated surfaces (wired in PR 3)
  // ---------------------------------------------------------------------

  /** Chat send — bounds both the write and the push fan-out it triggers. */
  chatMessageSend: {
    route: 'chat:message:send',
    limits: { perMinute: 30, perHour: 600, perDay: 3000 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  shareReply: {
    route: 'share:reply',
    limits: { perMinute: 20, perHour: 300, perDay: 1500 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /** Reactions are one tap, so the minute ceiling is loose by design. */
  shareReaction: {
    route: 'share:reaction',
    limits: { perMinute: 60, perHour: 600 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /** Barcode search fans out to Open Food Facts and USDA FDC. */
  barcodeSearch: {
    route: 'barcode:search',
    limits: { perMinute: 30, perHour: 300, perDay: 1500 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /** Uploads: bounded low because each one costs storage plus processing. */
  avatarUpload: {
    route: 'avatar:upload',
    limits: { perMinute: 5, perHour: 20, perDay: 50 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  feedbackScreenshot: {
    route: 'feedback:screenshot',
    limits: { perMinute: 5, perHour: 20, perDay: 50 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /**
   * Food-source candidates: one unindexed sequential scan of
   * `vietnamese_food_composition` per call (`>0` on an arbitrary nutrient
   * column, three `NOT ILIKE` patterns, an `ORDER BY` on the same column), on a
   * two-connection pool. Cheap for a human tapping a nutrient, ruinous on a
   * loop.
   */
  nutritionCandidates: {
    route: 'nutrition:candidates',
    limits: { perMinute: 30, perHour: 300 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /**
   * The admin pipeline-debug route. Admin-gated, but it runs the live
   * decomposition + nutrition calls against arbitrary input, so a stolen admin
   * session (or an admin with a loop) spends real Gemini quota. Fail-CLOSED for
   * the same reason `ocrGlobalDaily` is: admitting with the guard down means
   * spending with no ceiling, and there are single-digit admins to inconvenience.
   */
  adminDebugAnalysis: {
    route: 'admin:debug:analysis',
    limits: { perMinute: 3, perHour: 20 },
    keyKinds: ['user'],
    failMode: 'closed',
  },

  // ---------------------------------------------------------------------
  // Global spend budgets
  // ---------------------------------------------------------------------

  /**
   * The only FAIL-CLOSED policy in the table. Every OCR call spends Gemini
   * quota, so if the limiter cannot answer, admitting the request means
   * spending money with no ceiling — 503 is cheaper than an uncapped bill.
   *
   * `perMinute` is a BURST BREAKER, not the budget. Without one, a policy that
   * declares only `perDay` has no per-instance bucket in front of it (see
   * `burstConfig`), so every request in a flood reached Postgres — on the one
   * policy whose DB failure is a 503 for everybody. 60/min is far above real
   * OCR traffic (the per-user ceiling is 5/min) and still caps what one
   * instance can push at the limiter.
   */
  ocrGlobalDaily: {
    route: 'ocr:global:day',
    limits: { perMinute: 60, perDay: 5000 },
    keyKinds: ['global'],
    failMode: 'closed',
  },

  /**
   * FCM fan-out backstop. Degraded on purpose: this guard runs INSIDE the send
   * path, and failing it closed would turn a limiter outage into a failure to
   * save the user's message. The worst case is a skipped push.
   */
  pushGlobalHourly: {
    route: 'push:global:hour',
    limits: { perHour: 20000 },
    keyKinds: ['global'],
    failMode: 'degraded',
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof rateLimitPolicies;

export function getRateLimitPolicy(name: RateLimitPolicyName): RateLimitPolicy {
  return rateLimitPolicies[name];
}

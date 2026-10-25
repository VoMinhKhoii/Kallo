import type { RateLimitPolicy } from '../types';

/** The Supabase auth proxy and the emailed-link legs. Registry: `../policies.ts`. */
export const authPolicies = {
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
} as const satisfies Record<string, RateLimitPolicy>;

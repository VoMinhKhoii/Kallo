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
   * Every proxied auth operation, app-wide. Sized against the upstream GoTrue
   * budget so we shed load before Supabase does and can answer in our own
   * envelope instead of leaking theirs.
   */
  authGlobal: {
    route: 'auth:global',
    limits: { perMinute: 300, perHour: 3000 },
    keyKinds: ['global'],
    failMode: 'degraded',
  },

  /**
   * Token refresh and everything unclassified. Memory-only: a refresh storm is
   * a client bug, not an attack, and it must never cost a DB round trip on the
   * path that keeps a signed-in user signed in.
   *
   * `perMinute` only — see the `memory` arm of `RateLimitPolicy`. An hourly
   * number here would be a ceiling nothing enforces.
   */
  authRefresh: {
    route: 'auth:refresh',
    limits: { perMinute: 60 },
    keyKinds: ['ip'],
    failMode: 'memory',
  },

  authOther: {
    route: 'auth:other',
    limits: { perMinute: 60 },
    keyKinds: ['ip'],
    failMode: 'memory',
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

  // ---------------------------------------------------------------------
  // Global spend budgets
  // ---------------------------------------------------------------------

  /**
   * The only FAIL-CLOSED policy in the table. Every OCR call spends Gemini
   * quota, so if the limiter cannot answer, admitting the request means
   * spending money with no ceiling — 503 is cheaper than an uncapped bill.
   */
  ocrGlobalDaily: {
    route: 'ocr:global:day',
    limits: { perDay: 5000 },
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

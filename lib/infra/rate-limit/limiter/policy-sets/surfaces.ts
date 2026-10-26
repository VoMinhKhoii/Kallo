import type { RateLimitPolicy } from '../types';

/**
 * Public, unauthenticated surfaces and the authenticated ones without a slot.
 * Registry: `../policies.ts`.
 */
export const surfacePolicies = {
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

  /**
   * App-wide backstop for the waitlist surfaces — the botnet cap that applies
   * even when there is no IP to key on. `getRequestIp` returns `null` whenever
   * `cf-connecting-ip` is absent, and the per-IP policy is skipped there; a
   * caller flooding DISTINCT addresses with a null IP would otherwise be bounded
   * only by the per-address cooldown, i.e. not at all. Keyed on a constant
   * `global` value so signup and confirm each get their own counter row.
   */
  waitlistGlobal: {
    route: 'waitlist:global',
    limits: { perMinute: 30, perHour: 300 },
    keyKinds: ['global'],
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

  /**
   * CSP violation reports (`/api/csp-report`) — an anonymous write into the
   * logs, sent by browsers on their own schedule. Memory-only: a report must
   * never cost a database round trip, and losing some under a flood loses
   * nothing but log lines. A browser batches its reports, so one real visitor
   * rarely sends more than a few a minute; 30 is room for a busy NAT.
   */
  cspReportIp: {
    route: 'csp:report:ip',
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

  /** Block + unblock share one budget: toggling a block is a write to the
   * pair's edge and nothing a person does dozens of times a minute. */
  friendBlock: {
    route: 'friend:block',
    limits: { perMinute: 10, perHour: 60, perDay: 200 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /** Each accepted report emails every admin, so the ceiling bounds mail. */
  contentReport: {
    route: 'content:report',
    limits: { perMinute: 5, perHour: 30, perDay: 100 },
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

  /**
   * Product photos: one per scanned product, then cached on the device for a
   * week. Memory-only so a thumbnail never costs a database write; the upstream
   * fetch is served from Next's data cache after the first load anyway.
   */
  barcodeImageIp: {
    route: 'barcode:image:ip',
    limits: { perMinute: 60 },
    keyKinds: ['ip'],
    failMode: 'memory',
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

  /** Sign in with Apple code exchange: one Apple round trip per call, and a
   *  real client posts once per Apple sign-in. */
  appleTokenLink: {
    route: 'auth:apple:token',
    limits: { perMinute: 5, perHour: 20, perDay: 50 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /**
   * Signed view URL for the owner's own nutrition-label photo. Each call is a
   * row read plus a Storage signing request; a person opens a handful, so the
   * ceiling only bites a loop.
   */
  labelImageView: {
    route: 'label-image:view',
    limits: { perMinute: 30, perHour: 300 },
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
} as const satisfies Record<string, RateLimitPolicy>;

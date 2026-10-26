import type { RateLimitPolicy } from '../types';

/**
 * Per-user work with a one-at-a-time slot, AI-spend paths and the global
 * budgets. Registry: `../policies.ts`.
 */
export const spendPolicies = {
  // ---------------------------------------------------------------------
  // Per-user work with a one-at-a-time slot (`acquireRateLimit`)
  // ---------------------------------------------------------------------

  /**
   * Meal analysis (`/api/analyze-meal`), typed meals and cheat mode alike:
   * 30 a UTC day per person, one at a time. No minute or hour window: a
   * person logging a day's meals in one sitting is normal, and the slot
   * already caps one account at one analysis running.
   *
   * The slot's lifetime is past the route's 60 s `maxDuration`, so a request
   * that died without releasing frees it on its own. Fail-closed: every
   * analysis spends AI money. App Review accounts take the slot but are not
   * counted against the day (`app/api/analyze-meal/_lib/analysis-guard.ts`).
   */
  analyzeMeal: {
    route: 'analyze-meal',
    limits: { perDay: 30 },
    concurrency: { limit: 1, ttlSeconds: 90, retryAfterSeconds: 15 },
    keyKinds: ['user'],
    failMode: 'closed',
  },

  /**
   * A cheat-mode clarify answer: the reply to the question the estimator
   * asked, which does not count as one of the day's 30 meals. It has its own
   * day cap because nothing ties the field to a question that was asked —
   * without one, sending it on every request would escape the meal cap.
   */
  analyzeMealClarify: {
    route: 'analyze-meal:clarify',
    limits: { perDay: 30 },
    keyKinds: ['user'],
    failMode: 'closed',
  },

  /**
   * Nutrition-label OCR, per user. The slot is held from before the upload is
   * decoded, so one account cannot fan out parallel `sharp` decodes on a small
   * pool; `ocrGlobalDaily` and the AI spend brake are charged only right
   * before the provider call (`lib/infra/rate-limit/ocr-guard.ts`).
   */
  labelOcr: {
    route: 'ocr:scan',
    limits: { perMinute: 5, perHour: 30, perDay: 100 },
    concurrency: { limit: 1, ttlSeconds: 90, retryAfterSeconds: 5 },
    keyKinds: ['user'],
    failMode: 'closed',
  },

  /**
   * The relog picker's candidate search: two unindexed `LIKE '%…%'` scans per
   * call, fired on a 300 ms debounce while the user types, so the minute
   * ceiling clears fast typing. Two slots because one search already runs its
   * two arms in parallel.
   */
  relogCandidates: {
    route: 'relog:candidates',
    limits: { perMinute: 60, perHour: 900, perDay: 5000 },
    concurrency: { limit: 2, ttlSeconds: 90, retryAfterSeconds: 2 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /**
   * Every relog write (staging and the instant save share it): each holds
   * `FOR UPDATE` on the source meals, so one at a time per user.
   */
  relogWrite: {
    route: 'relog:write',
    limits: { perMinute: 12, perHour: 120, perDay: 500 },
    concurrency: { limit: 1, ttlSeconds: 90, retryAfterSeconds: 5 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /** Entitlement reconcile: one RevenueCat round trip per call. */
  entitlementsReconcile: {
    route: 'billing:reconcile',
    limits: { perMinute: 3, perHour: 20, perDay: 100 },
    concurrency: { limit: 1, ttlSeconds: 90, retryAfterSeconds: 5 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  /** The share card image: a CPU-heavy render, stateless, so no slot. */
  ogMacroCard: {
    route: 'og:macro-card',
    limits: { perMinute: 10, perHour: 60, perDay: 200 },
    keyKinds: ['user'],
    failMode: 'degraded',
  },

  // ---------------------------------------------------------------------
  // Global spend budgets
  // ---------------------------------------------------------------------

  /**
   * Legacy shadow candidate runs, app-wide: a sampled comparison nobody
   * waits on. A refusal, or a limiter that cannot answer, skips the run.
   */
  shadowDaily: {
    route: 'shadow:global:day',
    limits: { perDay: 100 },
    keyKinds: ['global'],
    failMode: 'closed',
  },

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
   * APNs fan-out backstop. Degraded on purpose: this guard runs INSIDE the send
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

import * as Sentry from '@sentry/nextjs';
import {
  serverSentryEnvironment,
  sharedSentryOptions,
} from '@/lib/infra/monitoring/sentry-options';

/** Uncaught route / Server Component / Server Action errors → Sentry. */
export const onRequestError = Sentry.captureRequestError;

/**
 * Next.js server-runtime init hook.
 *
 * Runs once per server boot in `next dev` and `next start` to eagerly warm
 * the in-process caches the v2 matching path otherwise lazy-loads on the
 * first request, which adds ~1-2s of cold latency to whoever hits
 * `/api/analyze-meal` first.
 *
 * Imports are dynamic because Next.js loads this file in BOTH the Node and
 * Edge runtimes; `@/lib/db` pulls in `postgres`, which can't initialize on
 * Edge. The `NEXT_RUNTIME` guard short-circuits before any import runs.
 *
 * Only `getNutritionCache` is invoked: its `loadAll` already does
 * `SELECT * FROM vietnamese_food_composition WHERE source_id = 1`, which
 * includes the embedding column, so it now also primes the embedding L1
 * cache via `primeEmbeddingCacheFromRows`. One SELECT, two caches warmed.
 * Errors are swallowed by `ensureInitialized` — the lazy-init paths remain
 * the source of truth on failure.
 *
 * Sentry is initialised first, in BOTH runtimes (middleware runs on Edge), so
 * a failure while warming caches is itself reported. `onRequestError` hands
 * every uncaught route / Server Component / Server Action error to Sentry.
 * Both are no-ops without `NEXT_PUBLIC_SENTRY_DSN` (see
 * `lib/infra/monitoring/sentry-options.ts`).
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' ||
    process.env.NEXT_RUNTIME === 'edge'
  ) {
    Sentry.init(sharedSentryOptions(serverSentryEnvironment()));
  }
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const [{ db }, { getNutritionCache }] = await Promise.all([
    import('@/lib/infra/db/client'),
    import('@/lib/ai/cache/nutrition-cache'),
  ]);

  const t0 = Date.now();
  await getNutritionCache(db);
  console.info(
    `[instrumentation] matching caches warm in ${Date.now() - t0}ms`
  );
}

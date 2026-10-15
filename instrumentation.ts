import * as Sentry from '@sentry/nextjs';
import {
  serverSentryEnvironment,
  sharedSentryOptions,
} from '@/lib/infra/telemetry/monitoring/sentry-options';

/** Uncaught route / Server Component / Server Action errors → Sentry. */
export const onRequestError = Sentry.captureRequestError;

/**
 * Next.js server-runtime init hook.
 *
 * Runs once per server boot in `next dev` and `next start`. Imports are
 * dynamic because Next.js loads this file in BOTH the Node and Edge runtimes;
 * `@/lib/db` pulls in `postgres`, which can't initialize on Edge. The
 * `NEXT_RUNTIME` guard short-circuits before any import runs.
 *
 * Card search starts loading here, never awaited: `register` must finish
 * before the server takes requests, and a page load should not wait on it. A
 * meal that arrives mid-load joins the same load. With a search artifact
 * pinned to this revision (`CARD_INDEX_URI`), that is the artifact (catalog
 * plus vector index, `lib/ai/matching/cards/search-index/`); without one,
 * the card catalog from the database (`getCardCatalog`, ~3 s on prod).
 *
 * Nothing else is warmed. Card matching fetches nutrition for a meal's own
 * candidates by id (`attachCandidateNutrition`, ~3 ms of database time on
 * prod), so an awaited nutrition preload would only delay every container
 * start (0.15–1.1 s measured on prod) for rows most meals never use.
 *
 * Sentry is initialised first, in BOTH runtimes (middleware runs on Edge), so
 * a failure while warming caches is itself reported. `onRequestError` hands
 * every uncaught route / Server Component / Server Action error to Sentry.
 * Both are no-ops without `NEXT_PUBLIC_SENTRY_DSN` (see
 * `lib/infra/telemetry/monitoring/sentry-options.ts`).
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' ||
    process.env.NEXT_RUNTIME === 'edge'
  ) {
    Sentry.init(sharedSentryOptions(serverSentryEnvironment()));
  }
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const [{ db }, { getCardCatalog }, { cardIndexConfigured }] =
    await Promise.all([
      import('@/lib/infra/db/client'),
      import('@/lib/ai/matching/cards/catalog'),
      import('@/lib/ai/matching/cards/search-index/search-index'),
    ]);

  // Starts the artifact load when one is pinned; failures are caught and
  // logged inside both loaders.
  if (!cardIndexConfigured()) void getCardCatalog(db);
}

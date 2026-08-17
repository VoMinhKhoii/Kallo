/**
 * Reset stuck server-side analysis-guard counters.
 *
 * The /api/analyze-meal route is gated by Postgres-backed counters in
 * `analysis_in_flight_limits` and `analysis_rate_limit_windows`. Aborted
 * SSE streams, dev hot-reloads mid-pipeline, and process kills mid-stream
 * can leave the in-flight `count` > 0. The runtime now self-heals rows older
 * than `ANALYSIS_IN_FLIGHT_STALE_AFTER_SECONDS` (default 90s), but this script
 * is still useful when you want to clear fresh/stuck rows immediately or wipe
 * the minute/hour/day counters too.
 *
 * Usage:
 *   bun --env-file=.env.local scripts/reset-analysis-guards.ts
 *   bun --env-file=.env.local scripts/reset-analysis-guards.ts --route=/api/analyze-meal
 *   bun --env-file=.env.local scripts/reset-analysis-guards.ts --windows  # also clear minute/hour/day windows
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/infra/db';
import {
  analysisInFlightLimits,
  analysisRateLimitWindows,
} from '@/lib/infra/db/schema';

if (!process.env.DATABASE_URL) {
  console.error(
    'Missing DATABASE_URL. Run with:\n  bun --env-file=.env.local scripts/reset-analysis-guards.ts'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const routeArg = args.find((a) => a.startsWith('--route='));
const route = routeArg?.split('=')[1] ?? '/api/analyze-meal';
const clearWindows = args.includes('--windows');

const client = postgres(encodeDbUrl(process.env.DATABASE_URL));
const db = drizzle(client);

async function main() {
  const inFlight = await db
    .update(analysisInFlightLimits)
    .set({ count: 0, updatedAt: new Date() })
    .where(eq(analysisInFlightLimits.route, route))
    .returning({
      keyKind: analysisInFlightLimits.keyKind,
      keyHash: analysisInFlightLimits.keyHash,
    });

  console.log(`Cleared ${inFlight.length} in-flight row(s) on route ${route}.`);

  if (clearWindows) {
    const windows = await db
      .delete(analysisRateLimitWindows)
      .where(eq(analysisRateLimitWindows.route, route))
      .returning({ keyHash: analysisRateLimitWindows.keyHash });

    console.log(
      `Deleted ${windows.length} rate-limit window row(s) on route ${route}.`
    );
  } else {
    console.log(
      'Rate-limit windows (minute/hour/day) untouched. Pass --windows to clear them too.'
    );
  }

  await client.end();
}

main().catch(async (err) => {
  console.error('reset-analysis-guards failed:', err);
  await client.end();
  process.exit(1);
});

/**
 * Reset a route's rate-limit counters in `rate_limit_counters` (dev / ops).
 *
 * A one-at-a-time slot frees itself when its lifetime runs out (90 s for
 * meal analysis), but a dev hot-reload or a killed process mid-stream can
 * leave one held until then. This frees every slot on a route now, and with
 * `--windows` deletes the route's rows outright, which also resets the
 * minute/hour/day counts. Routes are the `route` of a policy in
 * lib/infra/rate-limit/limiter/policies.ts.
 *
 * Usage:
 *   bun --env-file=.env.local scripts/ops/reset-rate-limits.ts
 *   bun --env-file=.env.local scripts/ops/reset-rate-limits.ts --route=ocr:scan
 *   bun --env-file=.env.local scripts/ops/reset-rate-limits.ts --windows  # also clear minute/hour/day counts
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { encodeDbUrl } from '@/lib/infra/db/client';
import { rateLimitCounters } from '@/lib/infra/db/schema';

if (!process.env.DATABASE_URL) {
  console.error(
    'Missing DATABASE_URL. Run with:\n  bun --env-file=.env.local scripts/ops/reset-rate-limits.ts'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const routeArg = args.find((a) => a.startsWith('--route='));
const route = routeArg?.split('=')[1] ?? 'analyze-meal';
const clearWindows = args.includes('--windows');

const client = postgres(encodeDbUrl(process.env.DATABASE_URL));
const db = drizzle(client);

async function main() {
  if (clearWindows) {
    const rows = await db
      .delete(rateLimitCounters)
      .where(eq(rateLimitCounters.route, route))
      .returning({ keyHash: rateLimitCounters.keyHash });
    console.log(`Deleted ${rows.length} counter row(s) on route ${route}.`);
  } else {
    const rows = await db
      .update(rateLimitCounters)
      .set({ slotExpiries: [], updatedAt: new Date() })
      .where(eq(rateLimitCounters.route, route))
      .returning({ keyHash: rateLimitCounters.keyHash });
    console.log(
      `Freed the slots on ${rows.length} row(s) on route ${route}. Pass --windows to clear the counts too.`
    );
  }

  await client.end();
}

main().catch(async (err) => {
  console.error('reset-rate-limits failed:', err);
  await client.end();
  process.exit(1);
});

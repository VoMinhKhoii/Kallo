import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { POST } from '@/app/api/webhooks/revenuecat/route';
import { getBillingEnvironment } from '@/lib/billing/revenuecat';
import { db } from '@/lib/db';

const configSchema = z.object({
  BILLING_REPLAY_LIMIT: z.coerce
    .number()
    .int()
    .positive()
    .max(500)
    .default(100),
  REVENUECAT_WEBHOOK_HMAC_SECRET: z.string().min(1).optional(),
  REVENUECAT_WEBHOOK_SECRET: z.string().min(1).optional(),
});

const config = configSchema.parse(process.env);
if (
  !config.REVENUECAT_WEBHOOK_HMAC_SECRET &&
  !config.REVENUECAT_WEBHOOK_SECRET
) {
  throw new Error('RevenueCat webhook authentication is not configured.');
}

const environment = getBillingEnvironment();

interface ClaimedEvent extends Record<string, unknown> {
  id: string;
  raw_payload: unknown;
}

let claimed = 0;
let succeeded = 0;
let failed = 0;

for (let index = 0; index < config.BILLING_REPLAY_LIMIT; index++) {
  // Claim only the row we are about to process. SKIP LOCKED lets overlapping
  // schedulers make progress on different rows, while no later row sits idle
  // long enough for its five-minute crash-recovery lease to expire.
  const pending = await db.execute<ClaimedEvent>(sql`
    WITH candidate AS (
      SELECT id
      FROM public.billing_webhook_events
      WHERE source = 'revenuecat'
        AND deployment_environment = ${environment}
        AND processed_at IS NULL
        AND dead_lettered_at IS NULL
        AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      ORDER BY next_attempt_at ASC NULLS FIRST, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE public.billing_webhook_events AS event
    SET next_attempt_at = now() + interval '5 minutes'
    FROM candidate
    WHERE event.id = candidate.id
    RETURNING event.id, event.raw_payload
  `);
  const event = pending[0];
  if (!event) break;
  claimed += 1;
  const rawBody = JSON.stringify(event.raw_payload);
  const headers = new Headers({ 'content-type': 'application/json' });
  if (config.REVENUECAT_WEBHOOK_HMAC_SECRET) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac(
      'sha256',
      config.REVENUECAT_WEBHOOK_HMAC_SECRET
    )
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    headers.set(
      'x-revenuecat-webhook-signature',
      `t=${timestamp},v1=${signature}`
    );
  } else {
    headers.set('authorization', config.REVENUECAT_WEBHOOK_SECRET as string);
  }

  const response = await POST(
    new Request('http://localhost/api/webhooks/revenuecat', {
      method: 'POST',
      headers,
      body: rawBody,
    })
  );
  if (response.ok) {
    succeeded += 1;
  } else {
    failed += 1;
    console.error(
      `[billing-replay] ${event.id} failed with HTTP ${response.status}`
    );
  }
}

console.log(
  `[billing-replay] environment=${environment} claimed=${claimed} succeeded=${succeeded} failed=${failed}`
);

if (failed > 0) process.exitCode = 1;

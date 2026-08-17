import { and, eq, isNotNull, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { getBillingEnvironment } from '@/lib/domain/billing/billing';
import { db } from '@/lib/infra/db';
import { billingWebhookEvents } from '@/lib/infra/db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

const config = z
  .object({
    BILLING_PROCESSED_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .max(3650)
      .default(30),
    BILLING_DEAD_LETTER_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .positive()
      .max(3650)
      .default(90),
  })
  .parse(process.env);
const environment = getBillingEnvironment();

const now = Date.now();
const processedCutoff = new Date(
  now - config.BILLING_PROCESSED_RETENTION_DAYS * DAY_MS
);
const deadLetterCutoff = new Date(
  now - config.BILLING_DEAD_LETTER_RETENTION_DAYS * DAY_MS
);

// Pending rows are intentionally excluded. Only completed replay envelopes
// and terminal dead letters age out under the documented retention policy.
const deleted = await db
  .delete(billingWebhookEvents)
  .where(
    and(
      eq(billingWebhookEvents.deploymentEnvironment, environment),
      or(
        and(
          isNotNull(billingWebhookEvents.processedAt),
          lt(billingWebhookEvents.processedAt, processedCutoff)
        ),
        and(
          isNotNull(billingWebhookEvents.deadLetteredAt),
          lt(billingWebhookEvents.deadLetteredAt, deadLetterCutoff)
        )
      )
    )
  )
  .returning({ id: billingWebhookEvents.id });

console.log(
  `[billing-prune] environment=${environment} deleted=${deleted.length} processed_days=${config.BILLING_PROCESSED_RETENTION_DAYS} dead_letter_days=${config.BILLING_DEAD_LETTER_RETENTION_DAYS}`
);

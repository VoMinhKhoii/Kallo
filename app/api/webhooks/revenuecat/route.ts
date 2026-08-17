import { handleRevenueCatWebhook } from '@/lib/domain/billing/billing';

export const runtime = 'nodejs';

/**
 * Next.js route entrypoint. The handler lives in
 * `lib/domain/billing/revenuecat/webhook/` because App Router reserves the
 * second exported-handler argument for route context, leaving no place to
 * inject the module's clock, database and CustomerInfo fetch.
 */
export async function POST(request: Request) {
  return handleRevenueCatWebhook(request);
}

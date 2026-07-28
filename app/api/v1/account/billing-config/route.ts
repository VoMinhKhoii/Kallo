import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import {
  type BillingEnvironment,
  getBillingEnvironmentForUser,
  isBillingSandboxUser,
} from '@/lib/billing/revenuecat';
import { getBillingConfig } from '@/lib/entitlements/config';

const WEB_CLIENT_KEY_PATTERN = /^rcb_[A-Za-z0-9]+$/;
const TEST_STORE_KEY_PATTERN = /^test_[A-Za-z0-9]+$/;

export function isRevenueCatWebClientKey(
  value: string,
  environment: BillingEnvironment
): boolean {
  return (
    WEB_CLIENT_KEY_PATTERN.test(value) ||
    (environment === 'sandbox' && TEST_STORE_KEY_PATTERN.test(value))
  );
}

/** Runtime web-billing config; the same container can serve sandbox or prod. */
export async function GET() {
  try {
    const { user } = await requireAuthAndProfile();
    const environment = getBillingEnvironmentForUser(user.id);
    const purchasesEnabled =
      getBillingConfig().purchasesEnabled || isBillingSandboxUser(user.id);
    const configuredKey = process.env.REVENUECAT_WEB_API_KEY;
    const apiKey =
      configuredKey && isRevenueCatWebClientKey(configuredKey, environment)
        ? configuredKey
        : null;
    return Response.json(
      {
        userId: user.id,
        purchasesEnabled,
        available: purchasesEnabled && Boolean(apiKey),
        apiKey: purchasesEnabled ? apiKey : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import {
  type BillingEnvironment,
  getBillingEnvironment,
  getBillingEnvironmentForUser,
  isBillingSandboxUser,
} from '@/lib/billing/revenuecat';
import { getBillingConfig } from '@/lib/entitlements/config';

// RevenueCat prefixes the public Web SDK key per billing engine: `rcb_` for
// RevenueCat Billing, `pdl_` for a Paddle-backed config (the same prefix in
// sandbox and production — the environment follows the Paddle account behind
// the config, not the key). Kallo sells on Paddle; `rcb_` stays accepted so
// swapping the billing engine is a dashboard change, not a deploy. This is an
// allowlist on purpose: a key that fails it is withheld and the paywall
// reports itself unavailable rather than shipping a secret to the browser.
const WEB_CLIENT_KEY_PATTERN = /^(?:rcb|pdl)_[A-Za-z0-9]+$/;
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

/**
 * Pick the web key for the environment this user's grants are projected into.
 *
 * A production deployment resolves App Review accounts in `BILLING_SANDBOX_USER_IDS`
 * to the sandbox environment. Handing such a user the production web key would
 * open checkout against the production Paddle account while the server
 * reconciles the sandbox one — the payment succeeds in a catalog the grant
 * projection never reads, so it is charged and dropped. Fail closed instead:
 * without a sandbox-specific key, that user gets no key and the paywall reports
 * itself unavailable.
 *
 * A wholly sandbox deployment (local, preview, staging) has no such split, so
 * the single key is used as-is.
 */
function resolveWebClientKey(
  userEnvironment: BillingEnvironment,
  deploymentEnvironment: BillingEnvironment
): string | undefined {
  const sandboxKey = process.env.REVENUECAT_WEB_API_KEY_SANDBOX;
  const defaultKey = process.env.REVENUECAT_WEB_API_KEY;
  if (userEnvironment !== 'sandbox') return defaultKey;
  if (sandboxKey) return sandboxKey;
  return deploymentEnvironment === 'sandbox' ? defaultKey : undefined;
}

/** Runtime web-billing config; the same container can serve sandbox or prod. */
export async function GET() {
  try {
    const { user } = await requireAuthAndProfile();
    const environment = getBillingEnvironmentForUser(user.id);
    const purchasesEnabled =
      getBillingConfig().purchasesEnabled || isBillingSandboxUser(user.id);
    const configuredKey = resolveWebClientKey(
      environment,
      getBillingEnvironment()
    );
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

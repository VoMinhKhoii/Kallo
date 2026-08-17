import 'server-only';

import { z } from 'zod';

// Which RevenueCat billing identity a request belongs to: the deployment's
// environment, and the narrow per-user override that moves an App Review
// account onto sandbox. Everything else in `lib/billing` keys grants, snapshots
// and provider syncs on the value resolved here.

export type BillingEnvironment = 'production' | 'sandbox';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Narrow production escape hatch for Apple's sandbox-only TestFlight/App
 * Review flow. Only explicitly listed Kallo accounts project sandbox grants;
 * every other production account remains isolated from sandbox transactions.
 */
export function isBillingSandboxUser(userId: string): boolean {
  return (process.env.BILLING_SANDBOX_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => UUID_PATTERN.test(value))
    .includes(userId);
}

export function getBillingEnvironmentForUser(
  userId: string,
  override?: BillingEnvironment
): BillingEnvironment {
  const deploymentEnvironment = getBillingEnvironment(override);
  return deploymentEnvironment === 'production' && isBillingSandboxUser(userId)
    ? 'sandbox'
    : deploymentEnvironment;
}

export function getBillingEnvironment(
  override?: BillingEnvironment
): BillingEnvironment {
  if (override) return override;
  const parsed = z
    .enum(['production', 'sandbox'])
    .safeParse(process.env.BILLING_ENVIRONMENT);
  if (!parsed.success) {
    throw new Error('billing_environment_missing_or_invalid');
  }
  return parsed.data;
}

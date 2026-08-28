/**
 * The one server-side gate every premium feature goes through.
 *
 * Two shapes of the same question. `checkFeatureGate` answers it without
 * throwing — for callers that degrade a response instead of refusing it (e.g.
 * stripping micronutrients out of an overview). `assertFeatureAccess` throws
 * `FeatureLockedError` (402), which `handleRouteError` serializes into the
 * envelope the web client and Flutter both key their paywall on.
 *
 * The BILLING_ENFORCEMENT_ENABLED kill-switch is checked FIRST in both, before
 * any database read: with the switch off nothing is gated and no entitlement
 * query is issued, so behavior is identical to a build without this module.
 */

import type { FeatureLockedReason } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import {
  checkFeatureAccess,
  getBillingConfig,
} from '@/lib/domain/billing/billing';
import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';

export interface FeatureGateInput {
  userId: string;
  profileCreatedAt: Date;
}

export type FeatureGateResult =
  | { locked: false }
  | { locked: true; reason: FeatureLockedReason };

/** Non-throwing gate. `{ locked: false }` whenever enforcement is off. */
export async function checkFeatureGate(
  input: FeatureGateInput,
  feature: FeatureKey
): Promise<FeatureGateResult> {
  if (!getBillingConfig().enforcementEnabled) return { locked: false };

  const access = await checkFeatureAccess(input, feature);
  if (access.allowed) return { locked: false };

  // `checkFeatureAccess` may also report 'entitled' / 'trial', but never
  // alongside allowed:false — anything that is not an expired trial is a
  // plain missing entitlement.
  const reason: FeatureLockedReason =
    access.reason === 'trial_expired' ? 'trial_expired' : 'not_entitled';
  return { locked: true, reason };
}

/** Throwing gate: `FeatureLockedError` (402) when the feature is locked. */
export async function assertFeatureAccess(
  input: FeatureGateInput,
  feature: FeatureKey
): Promise<void> {
  const gate = await checkFeatureGate(input, feature);
  if (gate.locked) throw Errors.featureLocked(feature, gate.reason);
}

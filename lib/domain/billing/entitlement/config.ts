import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';

// Server-configurable billing knobs, read from env so the owner can flip them
// without a deploy. There is no app-level trial: new accounts get a real
// 14-day Premium grant at signup instead (see docs/BILLING.md → "Welcome
// premium").

export interface BillingConfig {
  // Global enforcement kill-switch. Default false: gating decisions are
  // computed but routes must not block until the owner flips this on.
  enforcementEnabled: boolean;
  // Independent commerce kill-switch. Default false so a dark launch (or
  // rollback) cannot keep accepting new purchases while access is free.
  purchasesEnabled: boolean;
}

export function getBillingConfig(): BillingConfig {
  return {
    enforcementEnabled: readBooleanEnv('BILLING_ENFORCEMENT_ENABLED', false),
    purchasesEnabled: readBooleanEnv('BILLING_PURCHASES_ENABLED', false),
  };
}

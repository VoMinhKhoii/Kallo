import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';

// Server-configurable billing knobs. All three are read from env so the owner
// can tune the launch window, trial length, and enforcement kill-switch
// without a deploy.

const DEFAULT_TRIAL_DAYS = 7;

export interface BillingConfig {
  // Start of the app-level trial window for pre-launch accounts. When null
  // (env unset or unparseable), callers FAIL OPEN — the trial is treated as
  // active so nobody is locked out before the owner configures a launch date.
  launchDate: Date | null;
  trialDays: number;
  // Global enforcement kill-switch. Default false: gating decisions are
  // computed but routes must not block until the owner flips this on.
  enforcementEnabled: boolean;
}

function readTrialDays(): number {
  const raw = process.env.TRIAL_DAYS;
  if (raw == null || raw.trim() === '') return DEFAULT_TRIAL_DAYS;
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return DEFAULT_TRIAL_DAYS;
}

function readLaunchDate(): Date | null {
  const raw = process.env.SUBSCRIPTION_LAUNCH_DATE;
  if (raw == null || raw.trim() === '') return null;
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) {
    console.warn(
      `[billing] Invalid SUBSCRIPTION_LAUNCH_DATE (${raw}); treating as unset (trial fails open).`
    );
    return null;
  }
  return parsed;
}

export function getBillingConfig(): BillingConfig {
  return {
    launchDate: readLaunchDate(),
    trialDays: readTrialDays(),
    enforcementEnabled: readBooleanEnv('BILLING_ENFORCEMENT_ENABLED', false),
  };
}

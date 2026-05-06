import { createHmac } from 'node:crypto';

export const analysisGuardReasons = [
  'per_user_minute',
  'per_user_hour',
  'per_user_day',
  'concurrent_user',
  'admin_replay',
  'shadow_disabled',
  'global_budget',
  'provider_pressure',
  'spam_preflight',
] as const;

export type AnalysisGuardReason = (typeof analysisGuardReasons)[number];

export interface BuildAnalysisGuardEventInput {
  userId?: string | null;
  ip?: string | null;
  route: string;
  reason: AnalysisGuardReason;
  retryAfterSeconds?: number | null;
}

export interface AnalysisGuardEventRow {
  userIdHash: string | null;
  ipHash: string | null;
  route: string;
  reason: AnalysisGuardReason;
  retryAfterSeconds: number | null;
}

const testHashSecret = 'analysis-guard-event-test-secret';

function getAnalysisGuardHashSecret() {
  const secret = process.env.ANALYSIS_GUARD_HASH_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return testHashSecret;

  throw new Error('ANALYSIS_GUARD_HASH_SECRET is required');
}

function hashIdentifier(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function hashOptionalIdentifier(
  secret: string,
  domain: 'ip' | 'user',
  value: string | null | undefined
) {
  if (!value) return null;

  return hashIdentifier(secret, `${domain}:${value}`);
}

export function buildAnalysisGuardEvent(
  input: BuildAnalysisGuardEventInput
): AnalysisGuardEventRow {
  const secret = getAnalysisGuardHashSecret();

  return {
    userIdHash: hashOptionalIdentifier(secret, 'user', input.userId),
    ipHash: hashOptionalIdentifier(secret, 'ip', input.ip),
    route: input.route,
    reason: input.reason,
    retryAfterSeconds: input.retryAfterSeconds ?? null,
  };
}

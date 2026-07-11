import type { AppDb } from '@/lib/db';

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

export interface CheckAnalysisGuardsInput {
  userId: string;
  ip?: string | null;
  route: string;
  db?: AppDb;
  limits?: Partial<AnalysisGuardLimits>;
  now?: () => Date;
}

export interface CheckAdminReplayGuardInput {
  adminId: string;
  db?: AppDb;
  limits?: Partial<AdminReplayGuardLimits>;
  now?: () => Date;
}

export type AnalysisGuardAllowedResult = {
  allowed: true;
  release?: () => Promise<void> | void;
};

export type AnalysisGuardBlockedResult = {
  allowed: false;
  status: 429;
  reason: AnalysisGuardReason;
  retryAfterSeconds: number;
};

export type AnalysisGuardResult =
  | AnalysisGuardAllowedResult
  | AnalysisGuardBlockedResult;

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

export type AnalysisRateLimitWindowKind = 'minute' | 'hour' | 'day';

export interface AnalysisGuardLimits {
  perUserMinute: number;
  perUserHour: number;
  perUserDay: number;
  concurrentUser: number;
  concurrentRetryAfterSeconds: number;
}

export interface AdminReplayGuardLimits {
  perAdminHour: number;
}

export type AnalysisModelBudgetWorkKind = 'primary' | 'shadow' | 'nonessential';

export type AnalysisModelProviderErrorCategory =
  | 'rate_limit'
  | 'quota'
  | 'server_error'
  | 'timeout'
  | 'network'
  | 'unknown';

export interface RecordAnalysisModelBudgetEventInput {
  db?: AppDb;
  now?: () => Date;
  requestId?: string | null;
  route: string;
  workKind: AnalysisModelBudgetWorkKind;
  provider: string;
  model?: string | null;
  requestCount?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorCategory?: AnalysisModelProviderErrorCategory | null;
}

export interface NonessentialAnalysisGuardLimits {
  shadowDailyRequestLimit: number;
  globalDailyRequestLimit: number;
  globalDailyTokenLimit: number;
  providerErrorWindowSeconds: number;
  providerErrorThreshold: number;
  providerPressureRetryAfterSeconds: number;
}

export type NonessentialAnalysisGuardReason =
  | 'shadow_quota'
  | 'global_budget'
  | 'provider_pressure';

export type NonessentialAnalysisGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: NonessentialAnalysisGuardReason;
      retryAfterSeconds: number;
    };

export interface AnalysisModelDailyUsage {
  globalRequests: number;
  shadowRequests: number;
  globalTokens: number;
}

export interface AnalysisModelBudgetSourceInput {
  db?: AppDb;
  route: string;
  workKind: AnalysisModelBudgetWorkKind;
  provider: string;
  now: Date;
  dayStart: Date;
}

export interface AnalysisModelProviderErrorSourceInput {
  db?: AppDb;
  provider: string;
  now: Date;
  windowStart: Date;
}

export interface AnalysisModelBudgetSource {
  getDailyUsage: (
    input: AnalysisModelBudgetSourceInput
  ) => Promise<AnalysisModelDailyUsage>;
  getProviderErrorCount: (
    input: AnalysisModelProviderErrorSourceInput
  ) => Promise<number>;
}

export interface CheckNonessentialAnalysisGuardsInput {
  db?: AppDb;
  source?: AnalysisModelBudgetSource;
  route: string;
  workKind: AnalysisModelBudgetWorkKind;
  provider: string;
  model?: string | null;
  requestId?: string | null;
  limits?: Partial<NonessentialAnalysisGuardLimits>;
  now?: () => Date;
  reserve?: boolean;
}

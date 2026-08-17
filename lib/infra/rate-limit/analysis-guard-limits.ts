import type {
  AdminReplayGuardLimits,
  AnalysisGuardLimits,
  AnalysisRateLimitWindowKind,
  NonessentialAnalysisGuardLimits,
} from './analysis-guard-types';

export const defaultAnalysisGuardLimits: AnalysisGuardLimits = {
  perUserMinute: 3,
  perUserHour: 30,
  perUserDay: 100,
  concurrentUser: 1,
  concurrentRetryAfterSeconds: 15,
};

export const defaultAdminReplayGuardLimits: AdminReplayGuardLimits = {
  perAdminHour: 5,
};

export const defaultNonessentialAnalysisGuardLimits: NonessentialAnalysisGuardLimits =
  {
    shadowDailyRequestLimit: 100,
    globalDailyRequestLimit: 5000,
    globalDailyTokenLimit: 5_000_000,
    providerErrorWindowSeconds: 300,
    providerErrorThreshold: 5,
    providerPressureRetryAfterSeconds: 60,
  };

export const adminReplayGuardRoute = '/admin/pipeline-replay/live';

export const adminReplayWindowKind =
  'hour' satisfies AnalysisRateLimitWindowKind;

export function readPositiveInteger(
  value: string | number | undefined,
  fallback: number
) {
  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readNonNegativeInteger(
  value: string | number | null | undefined,
  fallback: number
) {
  if (value == null) return fallback;

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function resolveNonessentialAnalysisGuardLimits(
  overrides: Partial<NonessentialAnalysisGuardLimits> = {}
): NonessentialAnalysisGuardLimits {
  const envLimits = {
    shadowDailyRequestLimit: readPositiveInteger(
      process.env.ANALYSIS_SHADOW_DAILY_REQUEST_LIMIT,
      defaultNonessentialAnalysisGuardLimits.shadowDailyRequestLimit
    ),
    globalDailyRequestLimit: readPositiveInteger(
      process.env.ANALYSIS_GLOBAL_DAILY_REQUEST_LIMIT,
      defaultNonessentialAnalysisGuardLimits.globalDailyRequestLimit
    ),
    globalDailyTokenLimit: readPositiveInteger(
      process.env.ANALYSIS_GLOBAL_DAILY_TOKEN_LIMIT,
      defaultNonessentialAnalysisGuardLimits.globalDailyTokenLimit
    ),
    providerErrorWindowSeconds: readPositiveInteger(
      process.env.ANALYSIS_PROVIDER_ERROR_WINDOW_SECONDS,
      defaultNonessentialAnalysisGuardLimits.providerErrorWindowSeconds
    ),
    providerErrorThreshold: readPositiveInteger(
      process.env.ANALYSIS_PROVIDER_ERROR_THRESHOLD,
      defaultNonessentialAnalysisGuardLimits.providerErrorThreshold
    ),
    providerPressureRetryAfterSeconds: readPositiveInteger(
      process.env.ANALYSIS_PROVIDER_PRESSURE_RETRY_AFTER_SECONDS,
      defaultNonessentialAnalysisGuardLimits.providerPressureRetryAfterSeconds
    ),
  };

  return {
    shadowDailyRequestLimit: readPositiveInteger(
      overrides.shadowDailyRequestLimit,
      envLimits.shadowDailyRequestLimit
    ),
    globalDailyRequestLimit: readPositiveInteger(
      overrides.globalDailyRequestLimit,
      envLimits.globalDailyRequestLimit
    ),
    globalDailyTokenLimit: readPositiveInteger(
      overrides.globalDailyTokenLimit,
      envLimits.globalDailyTokenLimit
    ),
    providerErrorWindowSeconds: readPositiveInteger(
      overrides.providerErrorWindowSeconds,
      envLimits.providerErrorWindowSeconds
    ),
    providerErrorThreshold: readPositiveInteger(
      overrides.providerErrorThreshold,
      envLimits.providerErrorThreshold
    ),
    providerPressureRetryAfterSeconds: readPositiveInteger(
      overrides.providerPressureRetryAfterSeconds,
      envLimits.providerPressureRetryAfterSeconds
    ),
  };
}

export function normalizeProviderPressureOverride() {
  const value = process.env.ANALYSIS_PROVIDER_PRESSURE_OVERRIDE?.toLowerCase();

  if (value === 'on' || value === 'true' || value === 'force_on') {
    return 'on' as const;
  }

  if (value === 'off' || value === 'false' || value === 'force_off') {
    return 'off' as const;
  }

  return 'auto' as const;
}

export function resolveAnalysisGuardLimits(
  overrides: Partial<AnalysisGuardLimits> = {}
): AnalysisGuardLimits {
  const envLimits = {
    perUserMinute: readPositiveInteger(
      process.env.ANALYSIS_USER_MINUTE_LIMIT,
      defaultAnalysisGuardLimits.perUserMinute
    ),
    perUserHour: readPositiveInteger(
      process.env.ANALYSIS_USER_HOUR_LIMIT,
      defaultAnalysisGuardLimits.perUserHour
    ),
    perUserDay: readPositiveInteger(
      process.env.ANALYSIS_USER_DAY_LIMIT,
      defaultAnalysisGuardLimits.perUserDay
    ),
    concurrentUser: readPositiveInteger(
      process.env.ANALYSIS_USER_CONCURRENT_LIMIT,
      defaultAnalysisGuardLimits.concurrentUser
    ),
    concurrentRetryAfterSeconds: readPositiveInteger(
      process.env.ANALYSIS_CONCURRENT_RETRY_AFTER_SECONDS,
      defaultAnalysisGuardLimits.concurrentRetryAfterSeconds
    ),
  };

  return {
    perUserMinute: readPositiveInteger(
      overrides.perUserMinute,
      envLimits.perUserMinute
    ),
    perUserHour: readPositiveInteger(
      overrides.perUserHour,
      envLimits.perUserHour
    ),
    perUserDay: readPositiveInteger(overrides.perUserDay, envLimits.perUserDay),
    concurrentUser: readPositiveInteger(
      overrides.concurrentUser,
      envLimits.concurrentUser
    ),
    concurrentRetryAfterSeconds: readPositiveInteger(
      overrides.concurrentRetryAfterSeconds,
      envLimits.concurrentRetryAfterSeconds
    ),
  };
}

export function resolveAdminReplayGuardLimits(
  overrides: Partial<AdminReplayGuardLimits> = {}
): AdminReplayGuardLimits {
  const envLimits = {
    perAdminHour: readPositiveInteger(
      process.env.ANALYSIS_ADMIN_REPLAY_HOUR_LIMIT,
      defaultAdminReplayGuardLimits.perAdminHour
    ),
  };

  return {
    perAdminHour: readPositiveInteger(
      overrides.perAdminHour,
      envLimits.perAdminHour
    ),
  };
}

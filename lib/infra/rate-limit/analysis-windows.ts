import type { AnalysisRateLimitWindowKind } from './analysis-guard-types';

export function getAnalysisWindowStart(
  now: Date,
  windowKind: AnalysisRateLimitWindowKind
) {
  const windowStart = new Date(now);

  if (windowKind === 'day') {
    windowStart.setUTCHours(0, 0, 0, 0);
    return windowStart;
  }

  if (windowKind === 'hour') {
    windowStart.setUTCMinutes(0, 0, 0);
    return windowStart;
  }

  windowStart.setUTCSeconds(0, 0);
  return windowStart;
}

export function getAnalysisWindowEnd(
  windowStart: Date,
  windowKind: AnalysisRateLimitWindowKind
) {
  const windowEnd = new Date(windowStart);

  if (windowKind === 'day') {
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
    return windowEnd;
  }

  if (windowKind === 'hour') {
    windowEnd.setUTCHours(windowEnd.getUTCHours() + 1);
    return windowEnd;
  }

  windowEnd.setUTCMinutes(windowEnd.getUTCMinutes() + 1);
  return windowEnd;
}

export function getAnalysisWindowRetryAfterSeconds(
  now: Date,
  windowStart: Date,
  windowKind: AnalysisRateLimitWindowKind
) {
  const windowEnd = getAnalysisWindowEnd(windowStart, windowKind);
  const remainingMs = windowEnd.getTime() - now.getTime();

  return Math.max(1, Math.ceil(remainingMs / 1000));
}

// ---------------------------------------------------------------------------
// Meal reads — client-side REST helpers
// ---------------------------------------------------------------------------
// The web's meal queries read through these GETs instead of calling the Server
// Actions directly: the browser runs Server Actions one at a time, so a page's
// reads (its day, the timeline, the prefetched neighbours) queued behind each
// other, each a full round trip. GETs run in parallel. The routes wrap the same
// functions the mobile app reads, so the shapes are the actions' own types.

import type {
  LoggingDayData,
  PersistedMeal,
  RecentCheatOccasion,
} from '@/lib/actions/meals/types';
import { request } from '@/lib/api/client-fetch';
import type { RelogCandidatesResponse } from '@/lib/domain/logging/relog/relog';
import type { MealDateSummary } from '@/lib/domain/logging/types';

export function fetchMealsByDate(input: {
  date: string;
  timezoneOffset: number;
}): Promise<PersistedMeal[]> {
  return request(`/api/v1/meals?date=${input.date}&tz=${input.timezoneOffset}`);
}

export function fetchLoggingDay(input: {
  date: string;
  timezoneOffset: number;
}): Promise<LoggingDayData> {
  return request(
    `/api/v1/logging/day?date=${input.date}&tz=${input.timezoneOffset}`
  );
}

export function fetchMealDateSummaries(input: {
  timezoneOffset: number;
}): Promise<MealDateSummary[]> {
  return request(`/api/v1/meals/dates/summaries?tz=${input.timezoneOffset}`);
}

export function fetchRecentCheatOccasions(input: {
  limit: number;
}): Promise<RecentCheatOccasion[]> {
  return request(`/api/v1/meals/cheat-occasions?limit=${input.limit}`);
}

export function fetchRelogCandidates(input: {
  q: string;
  limit: number;
}): Promise<RelogCandidatesResponse> {
  const params = new URLSearchParams({
    q: input.q,
    limit: String(input.limit),
  });
  return request(`/api/v1/meals/relog/candidates?${params}`);
}

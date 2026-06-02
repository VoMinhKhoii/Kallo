import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WeightSummaryData } from '@/lib/api/contracts/weight';
import type { WeightRange } from '@/lib/types/weight';
import { apiDelete, apiGet, apiPost } from '~/lib/api-client';
import { weightSummaryKeys } from './keys';

/**
 * Loads the weight-summary payload (chart series + plan baseline) from the REST
 * surface. Mirrors the web `useWeightSummary` (hooks/use-weight-summary.ts):
 * 2-element key by range (NO timezone offset, unlike the logging-day key),
 * `timezoneOffset` derived with standard JS and sent as `&tz=`, staleTime
 * 30_000, structuralSharing on. Read-only — no mutations refetch from here.
 */
export function useWeightSummary(range: WeightRange, enabled = true) {
  const timezoneOffset = new Date().getTimezoneOffset();
  return useQuery<WeightSummaryData>({
    queryKey: weightSummaryKeys.byRange(range),
    queryFn: () =>
      apiGet<WeightSummaryData>(
        `/api/v1/weight/summary?range=${range}&tz=${timezoneOffset}`
      ),
    staleTime: 30_000,
    structuralSharing: true,
    enabled,
  });
}

interface LogWeightInput {
  loggedDate: string; // local YYYY-MM-DD
  weightKg: number;
}

interface LogWeightResult {
  success: true;
  loggedDate: string;
  weightKg: number;
}

/**
 * Logs (upserts) a day's weight via `POST /api/v1/weight`. Mirrors the web
 * `useLogWeight` (hooks/use-weight-mutations.ts): no optimistic updates — await
 * the POST, then invalidate the broad `weightSummaryKeys.all` prefix so BOTH
 * the 30d and 90d summaries refetch. NEVER add `exact: true`. ApiError.message
 * propagates to the caller's onError.
 */
export function useLogWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LogWeightInput) =>
      apiPost<LogWeightResult>('/api/v1/weight', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: weightSummaryKeys.all }),
  });
}

/**
 * Updates today's (or any day's) weight. The server route is an UPSERT on
 * `(userId, loggedDate)` via `POST /api/v1/weight` — there is NO PUT handler on
 * the per-date route (it only implements DELETE), so "update" re-POSTs to the
 * same upsert endpoint. This matches the web, where the weight card's "Update"
 * button re-submits through the same log mutation.
 */
export function useUpdateWeight() {
  return useLogWeight();
}

interface DeleteWeightInput {
  loggedDate: string; // local YYYY-MM-DD
}

/**
 * Deletes a day's weight via `DELETE /api/v1/weight/[loggedDate]`. Mirrors the
 * web `useDeleteWeightLog`: same broad `weightSummaryKeys.all` invalidation on
 * success (prefix-match, no `exact: true`).
 */
export function useDeleteWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loggedDate }: DeleteWeightInput) =>
      apiDelete(`/api/v1/weight/${encodeURIComponent(loggedDate)}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: weightSummaryKeys.all }),
  });
}

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '~/lib/api-client';
import { mealDatesKey } from './keys';

/**
 * Loads the set of dates that have logged meals (the "has meals" dots in the
 * timeline picker). Mirrors the web `LoggingShell` query (key prefix
 * `['meal-dates', ...]`, 60s staleTime) but fetches `GET /api/v1/meals/dates`
 * instead of the server action. The endpoint returns a `string[]` of YYYY-MM-DD.
 * Invalidations elsewhere use the `['meal-dates']` prefix and rely on TanStack
 * prefix matching — never add `exact: true`.
 */
export function useMealDates(userId: string | undefined) {
  const timezoneOffset = new Date().getTimezoneOffset();
  return useQuery<string[]>({
    queryKey: mealDatesKey(userId ?? '', timezoneOffset),
    queryFn: () => apiGet<string[]>(`/api/v1/meals/dates?tz=${timezoneOffset}`),
    staleTime: 60_000,
    enabled: !!userId,
  });
}

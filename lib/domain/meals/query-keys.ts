/**
 * TanStack Query keys for the meal caches.
 *
 * They live here rather than beside the hooks that read them because the write
 * side needs them too: `save/` cancels, seeds and invalidates these exact keys
 * from `lib/`, which may not import from `hooks/`. Written out by hand at each
 * call site, a rename in one place would silently stop another from
 * invalidating — stale calorie rings being precisely what that invalidation
 * exists to prevent.
 */

export const loggingDayKeys = {
  all: ['logging-day'] as const,
  // 3-element key. NOTE: this is intentionally a PREFIX of byUserDateOffset and
  // is the key mutations target (cancel/setQueriesData/invalidateQueries) so a
  // write reaches the active query regardless of its tz-offset segment. It is
  // NOT exact-matchable: getQueryData(byUserDate(...)) returns undefined — only
  // the *Queries (prefix-matching) APIs hit the stored entry. Do not add
  // `exact: true` against this key in the mutation callbacks.
  byUserDate: (userId: string, date: string) =>
    ['logging-day', userId, date] as const,
  // 4-element key the query is actually registered under (see useLoggingDay).
  byUserDateOffset: (userId: string, date: string, timezoneOffset: number) =>
    ['logging-day', userId, date, timezoneOffset] as const,
};

/** Query key factory for daily meals */
export const dailyMealsKeys = {
  all: ['daily-meals'] as const,
  byDate: (date: string) => ['daily-meals', date] as const,
};

export const recentCheatOccasionsKeys = {
  all: ['recent-cheat-occasions'] as const,
  byUser: (userId: string) => ['recent-cheat-occasions', userId] as const,
};

export const relogCandidatesKeys = {
  all: ['relog-candidates'] as const,
  byQuery: (query: string) => ['relog-candidates', query] as const,
};

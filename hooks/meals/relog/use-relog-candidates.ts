'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/ui/use-debounced-value';
import { loadRelogCandidatesAction } from '@/lib/actions/meals/relog/load-candidates';
import {
  RELOG_SEARCH_LIMIT,
  type RelogCandidate,
  type RelogCandidatesResponse,
} from '@/lib/domain/logging/relog/relog';
import { relogCandidatesKeys } from '@/lib/domain/meals/query-keys';

const DEBOUNCE_MS = 300;

const EMPTY: RelogCandidatesResponse = { dishes: [], meals: [] };

export interface RelogCandidateList extends RelogCandidatesResponse {
  /** Both groups in render order. The picker's keyboard state machine walks
   *  this, so it never has to know groups exist — headers are presentational
   *  and can't be landed on. */
  options: RelogCandidate[];
  isLoading: boolean;
  /** True while a NEW query is resolving. `keepPreviousData` means `dishes`
   *  and `meals` still hold the last results, so the popup shows stale rows
   *  rather than flashing empty; this drives a subtle pending affordance. */
  isFetching: boolean;
}

/**
 * Debounced candidate search for the `/` picker. Deterministic and server-side
 * — the query text goes straight to SQL, so there is nothing to filter here.
 *
 * `keepPreviousData` is what stops the popup collapsing to "no results" between
 * keystrokes; without it, every character would unmount the list and the
 * highlight with it.
 */
export function useRelogCandidates(
  query: string,
  enabled: boolean
): RelogCandidateList {
  const debounced = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  const { data, isLoading, isFetching } = useQuery<RelogCandidatesResponse>({
    queryKey: relogCandidatesKeys.byQuery(debounced),
    queryFn: () =>
      loadRelogCandidatesAction({
        q: debounced,
        limit: RELOG_SEARCH_LIMIT,
      }),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const resolved = data ?? EMPTY;
  const options = useMemo<RelogCandidate[]>(
    () => [...resolved.dishes, ...resolved.meals],
    [resolved.dishes, resolved.meals]
  );

  return {
    dishes: resolved.dishes,
    meals: resolved.meals,
    options,
    isLoading,
    isFetching,
  };
}

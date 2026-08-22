'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/ui/use-debounced-value';
import type {
  IngredientSearchResponse,
  IngredientSearchResult,
} from '@/lib/domain/logging/manual-logging';

const DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;

async function fetchIngredients(q: string): Promise<IngredientSearchResult[]> {
  const params = new URLSearchParams({ limit: String(SEARCH_LIMIT) });
  if (q) params.set('q', q);
  const res = await fetch(`/api/v1/ingredients/search?${params}`);
  if (!res.ok) {
    throw new Error('Không thể tìm nguyên liệu.');
  }
  const data = (await res.json()) as IngredientSearchResponse;
  return data.results;
}

/**
 * Debounced, deterministic ingredient search against
 * `GET /api/v1/ingredients/search`. An empty query returns the user's recent
 * foods (instant suggestions before typing). Previous results are kept while
 * a new query is in flight so the dropdown never flickers empty mid-typing.
 */
export function useIngredientSearch(query: string, enabled: boolean) {
  const q = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  return useQuery<IngredientSearchResult[]>({
    queryKey: ['ingredient-search', q],
    queryFn: () => fetchIngredients(q),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

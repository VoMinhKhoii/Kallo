'use client';

import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/ui/use-debounced-value';
import { searchAccountsAction } from '@/lib/admin/premium/actions/search-action';

/** Typeahead over accounts for /admin/premium; quiet below 2 characters. */
export function useAccountSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);
  return useQuery({
    queryKey: ['admin', 'premium', 'account-search', debounced],
    queryFn: async () => {
      const result = await searchAccountsAction(debounced);
      if (!result.success) throw new Error(result.error);
      return result.matches;
    },
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });
}

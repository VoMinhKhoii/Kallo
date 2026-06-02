import { useQuery } from '@tanstack/react-query';
import type { CandidatesResponse } from '@/lib/api/contracts/nutrition';
import type { NutritionNutrientKey } from '@/lib/nutrition/types';
import { apiPost } from '~/lib/api-client';
import { asSupported } from './candidate-nutrients';

/**
 * Loads curated food-source candidates for a nutrient. Mirrors the web
 * `FoodChipRow` query: key `['nutrition','candidates', supported]`,
 * `retry:false`, 60s `staleTime`, disabled when the nutrient is unsupported.
 * The catalog is static, so the data is deterministic per nutrient.
 */
export function useFoodCandidates(
  nutrient: NutritionNutrientKey,
  enabled = true
) {
  const supported = asSupported(nutrient);
  return useQuery<CandidatesResponse>({
    // Matches the web key shape exactly (supported may be null when disabled).
    queryKey: ['nutrition', 'candidates', supported],
    queryFn: () => {
      if (!supported) {
        throw new Error('Unsupported candidate nutrient.');
      }
      return apiPost<CandidatesResponse>('/api/v1/nutrition/candidates', {
        nutrient: supported,
      });
    },
    enabled: enabled && supported !== null,
    retry: false,
    staleTime: 60_000,
  });
}

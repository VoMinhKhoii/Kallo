import { useQuery } from '@tanstack/react-query';
import type { CandidatesResponse } from '@/lib/api/contracts/nutrition';
import type { NutritionNutrientKey } from '@/lib/nutrition/types';
import { apiPost } from '~/lib/api-client';
import { asSupported } from '../logic/candidate-nutrients';

/**
 * Loads curated food-source candidates for a nutrient. Mirrors the web
 * `FoodChipRow` query: key `['nutrition','candidates', supported]`,
 * `retry:false`, disabled when the nutrient is unsupported.
 *
 * The catalog is STATIC and deterministic per nutrient, but the nutrition
 * screen renders one `FoodChipRow` per spotlight/detail card, so this hook
 * fans out N parallel requests — each paying a server auth round-trip + DB
 * gate for data that never changes. We therefore cache it for the whole
 * session (`staleTime`/`gcTime: Infinity`): each nutrient is fetched at most
 * once. This deliberately diverges from web's 60s window because mobile's
 * fan-out makes repeat fetches far more costly.
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
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
}

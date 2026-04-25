'use server';

import { requireAuthAndProfile } from '@/lib/auth';
import { getCuratedFoodSourceCandidates } from '../food-source-candidates';
import { foodSourceCandidatesInputSchema } from '../schemas';

export async function getFoodSourceCandidates(input: unknown) {
  const parsed = foodSourceCandidatesInputSchema.parse(input);
  await requireAuthAndProfile();

  return {
    nutrient: parsed.nutrient,
    candidates: getCuratedFoodSourceCandidates(parsed.nutrient),
  };
}

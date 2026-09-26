import type { NextRequest } from 'next/server';
import { ingredientSearchQuerySchema } from '@/lib/api/contracts/ingredients';
import { handleRouteError } from '@/lib/api/respond';
import { searchIngredients } from '@/lib/domain/ingredients/search/ingredient-search';
import { hasAiConsent } from '@/lib/domain/privacy/ai-consent';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export async function GET(req: NextRequest) {
  try {
    const { user, profile } = await requireAuthAndProfile();
    const { q, limit } = ingredientSearchQuerySchema.parse({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    // No AI-cost guards here: this is a cheap indexed query, throttled by auth,
    // the limit cap, and client-side debounce.
    // Never a 403: without AI consent the query is simply not sent to the
    // embedding provider, and the picker gets trigram-led results.
    const results = await searchIngredients({
      userId: user.id,
      q,
      limit,
      allowLiveEmbedding: hasAiConsent(profile),
    });

    return Response.json({ results });
  } catch (error) {
    return handleRouteError(error);
  }
}

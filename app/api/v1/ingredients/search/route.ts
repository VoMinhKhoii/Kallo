import type { NextRequest } from 'next/server';
import { ingredientSearchQuerySchema } from '@/lib/api/contracts/ingredients';
import { handleRouteError } from '@/lib/api/respond';
import { searchIngredients } from '@/lib/domain/ingredients/search/ingredient-search';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuthAndProfile();
    const { q, limit } = ingredientSearchQuerySchema.parse({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });

    // No AI-cost guards here: this is a cheap indexed query, throttled by auth,
    // the limit cap, and client-side debounce.
    const results = await searchIngredients({ userId: user.id, q, limit });

    return Response.json({ results });
  } catch (error) {
    return handleRouteError(error);
  }
}

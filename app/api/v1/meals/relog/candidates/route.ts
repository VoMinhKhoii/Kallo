import type { NextRequest } from 'next/server';
import { loadRelogCandidatesAction } from '@/lib/actions/meals/relog/load-candidates';
import { relogCandidatesQuerySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/** `GET /api/v1/meals/relog/candidates` — the `/`-picker search. Exists for the
 *  Flutter client; the web composer calls the Server Action directly. */
export async function GET(req: NextRequest) {
  try {
    const { q, limit } = relogCandidatesQuerySchema.parse({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });
    const result = await loadRelogCandidatesAction({ q, limit });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

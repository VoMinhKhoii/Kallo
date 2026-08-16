import type { NextRequest } from 'next/server';
import { loadRelogCandidatesAction } from '@/lib/actions/meals/relog/load-candidates';
import { relogCandidatesQuerySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** `GET /api/v1/meals/relog/candidates` — the `/`-picker search. Exists for the
 *  Flutter client; the web composer calls the Server Action directly. */
export async function GET(req: NextRequest) {
  try {
    // Authenticate BEFORE validating. The action authenticates too, but
    // `requireAuthAndProfile` is memoized per request, so this is free — and it
    // stops an unauthenticated caller getting a 400 that tells them which
    // params are well-formed.
    await requireAuthAndProfile();

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

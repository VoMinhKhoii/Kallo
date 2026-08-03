import type { NextRequest } from 'next/server';
import { guardRelogRequest } from '@/app/api/v1/meals/relog/_guard';
import { loadRelogCandidatesAction } from '@/lib/actions/meals/relog/load-candidates';
import { relogCandidatesQuerySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';

export const runtime = 'nodejs';

/** `GET /api/v1/meals/relog/candidates` — the `/`-picker search. Exists for the
 *  Flutter client; the web composer calls the Server Action directly. */
export async function GET(req: NextRequest) {
  let release: (() => Promise<void> | void) | undefined;
  try {
    // Authenticate BEFORE validating. The action authenticates too, but
    // `requireAuthAndProfile` is memoized per request, so this is free — and it
    // stops an unauthenticated caller getting a 400 that tells them which
    // params are well-formed.
    const { user } = await requireAuthAndProfile();
    const guard = await guardRelogRequest(
      'candidates',
      'meals-relog-candidates',
      user.id
    );
    if (guard.blocked) return guard.blocked;
    release = guard.release;

    const { q, limit } = relogCandidatesQuerySchema.parse({
      q: req.nextUrl.searchParams.get('q') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });
    const result = await loadRelogCandidatesAction({ q, limit });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  } finally {
    await release?.();
  }
}

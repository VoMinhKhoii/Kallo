import type { NextRequest } from 'next/server';
import { loadRecentCheatOccasionsAction } from '@/lib/actions/meals/cheat';
import { cheatOccasionsQuerySchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { limit } = cheatOccasionsQuerySchema.parse({
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    });
    const result = await loadRecentCheatOccasionsAction({ limit });
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

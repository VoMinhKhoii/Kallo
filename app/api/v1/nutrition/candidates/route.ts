import type { NextRequest } from 'next/server';
import { readJsonBody } from '@/lib/api/auth';
import { candidatesSchema } from '@/lib/api/contracts/nutrition';
import { handleRouteError } from '@/lib/api/respond';
import { getFoodSourceCandidates } from '@/lib/domain/nutrition/actions/candidates';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = candidatesSchema.parse(await readJsonBody(req));
    const result = await getFoodSourceCandidates(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

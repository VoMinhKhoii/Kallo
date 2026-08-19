import type { NextRequest } from 'next/server';
import { candidatesSchema } from '@/lib/api/contracts/nutrition';
import { handleRouteError } from '@/lib/api/respond';
import { getFoodSourceCandidates } from '@/lib/domain/nutrition/actions/candidates';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = candidatesSchema.parse(await req.json());
    const result = await getFoodSourceCandidates(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

import type { NextRequest } from 'next/server';
import { logWeightAction } from '@/lib/actions/tracking/weight';
import { readJsonBody } from '@/lib/api/auth';
import { weightLogSchema } from '@/lib/api/contracts/weight';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = weightLogSchema.parse(await readJsonBody(req));
    const result = await logWeightAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

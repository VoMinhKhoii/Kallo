import type { NextRequest } from 'next/server';
import { logWeightAction } from '@/lib/actions/tracking/weight';
import { weightLogSchema } from '@/lib/api/contracts/weight';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = weightLogSchema.parse(await req.json());
    const result = await logWeightAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

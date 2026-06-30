import type { NextRequest } from 'next/server';
import { saveManualMealAction } from '@/lib/actions/manual-meals';
import { saveManualMealSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = saveManualMealSchema.parse(await req.json());
    const result = await saveManualMealAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

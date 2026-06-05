import type { NextRequest } from 'next/server';
import { confirmAndSaveMealAction } from '@/lib/actions/meals';
import { confirmMealSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = confirmMealSchema.parse(await req.json());
    const result = await confirmAndSaveMealAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

import type { NextRequest } from 'next/server';
import { stageCheatRepeatAction } from '@/lib/actions/meals/cheat';
import { cheatRepeatSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = cheatRepeatSchema.parse(await req.json());
    const result = await stageCheatRepeatAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

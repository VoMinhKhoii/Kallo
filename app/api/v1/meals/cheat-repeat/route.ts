import type { NextRequest } from 'next/server';
import { stageCheatRepeatAction } from '@/lib/actions/meals/cheat/occasions';
import { readJsonBody } from '@/lib/api/auth';
import { cheatRepeatSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireAuthAndProfile();

    const body = cheatRepeatSchema.parse(await readJsonBody(req));
    const result = await stageCheatRepeatAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

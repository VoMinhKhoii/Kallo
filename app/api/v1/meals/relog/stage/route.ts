import type { NextRequest } from 'next/server';
import { guardRelogRequest } from '@/app/api/v1/meals/relog/_guard';
import { stageRelogAnalysisAction } from '@/lib/actions/meals/relog/stage-relog-analysis';
import { stageRelogAnalysisSchema } from '@/lib/api/contracts/meals';
import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';

export const runtime = 'nodejs';

/** `POST /api/v1/meals/relog/stage` — stage the picked references as a pending
 *  analysis so they surface in the ordinary editable review card. Exists for
 *  the Flutter client; the web composer calls the Server Action directly.
 *
 *  This, not the instant-save `POST /api/v1/meals/relog`, is what the composer's
 *  `/` picker submits to: a pure-relog submit must produce the SAME confirmable
 *  card as a combined text+picks submit (which the analyze-meal `refs` merge
 *  already does), or the composer would save two different ways depending on
 *  whether the user happened to type anything alongside their picks.
 *
 *  The body carries only references, never nutrition. */
export async function POST(req: NextRequest) {
  let release: (() => Promise<void> | void) | undefined;
  try {
    const { user } = await requireAuthAndProfile();
    const guard = await guardRelogRequest(
      'write',
      'meals-relog-stage',
      user.id
    );
    if (guard.blocked) return guard.blocked;
    release = guard.release;

    const body = stageRelogAnalysisSchema.parse(await req.json());
    const result = await stageRelogAnalysisAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  } finally {
    await release?.();
  }
}

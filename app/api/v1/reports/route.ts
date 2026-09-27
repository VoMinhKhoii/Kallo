import { type NextRequest, NextResponse } from 'next/server';
import { createContentReport } from '@/lib/actions/moderation/reports';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { createReportBodySchema } from '@/lib/api/contracts/social/moderation';
import { handleRouteError } from '@/lib/api/respond';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

/** Report a share, reply, chat message, chat group or profile. 201 with the
 * report id; a repeat report of the same target returns the same id. */
export async function POST(request: NextRequest) {
  try {
    const actorId = await requireUserId();
    // Charged before the body is read: each accepted report emails the admins.
    await assertRateLimit('contentReport', { kind: 'user', value: actorId });
    const body = createReportBodySchema.parse(await readJsonBody(request));
    const result = await createContentReport(actorId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

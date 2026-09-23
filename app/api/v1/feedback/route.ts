import type { NextRequest } from 'next/server';
import { submitFeedbackAction } from '@/lib/actions/support/feedback';
import { readJsonBody, requireUserId } from '@/lib/api/auth';
import { submitFeedbackSchema } from '@/lib/api/contracts/feedback';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/** Submit in-app feedback (bug report, ingredient request, or idea). */
export async function POST(req: NextRequest) {
  try {
    // Authenticate before touching the body: an anonymous caller gets a 401
    // without the server reading or parsing a byte (KALLO-08). The action
    // keeps its own check as the authoritative boundary.
    await requireUserId();

    const body = submitFeedbackSchema.parse(await readJsonBody(req));
    const result = await submitFeedbackAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

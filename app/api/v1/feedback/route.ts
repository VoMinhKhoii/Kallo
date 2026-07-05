import type { NextRequest } from 'next/server';
import { submitFeedbackAction } from '@/lib/actions/feedback';
import { submitFeedbackSchema } from '@/lib/api/contracts/feedback';
import { handleRouteError } from '@/lib/api/respond';

export const runtime = 'nodejs';

/** Submit in-app feedback (bug report, ingredient request, or idea). */
export async function POST(req: NextRequest) {
  try {
    const body = submitFeedbackSchema.parse(await req.json());
    const result = await submitFeedbackAction(body);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

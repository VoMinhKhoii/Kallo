import type { NextRequest } from 'next/server';
import { uploadFeedbackScreenshotAction } from '@/lib/actions/support/feedback';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/errors/catalog';

export const runtime = 'nodejs';

/**
 * Upload an optional feedback screenshot as multipart form-data (field `file`).
 * Returns `{ path }` to send as `screenshotPath` on `POST /api/v1/feedback`.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw Errors.validationFailed('Expected a `file` upload.');
    }
    const result = await uploadFeedbackScreenshotAction(file);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

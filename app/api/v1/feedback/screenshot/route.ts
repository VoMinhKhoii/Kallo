import type { NextRequest } from 'next/server';
import { uploadFeedbackScreenshotAction } from '@/lib/actions/support/feedback';
import { requireUserId } from '@/lib/api/auth';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/core/errors/catalog';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { MAX_IMAGE_BYTES } from '@/lib/infra/uploads/image-file';

export const runtime = 'nodejs';

/**
 * Upload an optional feedback screenshot as multipart form-data (field `file`).
 * Returns `{ path }` to send as `screenshotPath` on `POST /api/v1/feedback`.
 */
export async function POST(req: NextRequest) {
  try {
    // Auth FIRST. This route used to call `req.formData()` before any identity
    // check, so an ANONYMOUS caller could make the server buffer an unbounded
    // multipart body — the sweep's OOM finding. Nothing below touches the body
    // until both the caller and the declared size are known.
    const userId = await requireUserId();
    await assertRateLimit('feedbackScreenshot', {
      kind: 'user',
      value: userId,
    });

    // Reject oversized requests before req.formData() buffers the whole body
    // (multipart framing overhead on top of the 5 MB file cap). A missing or
    // non-numeric Content-Length is rejected too — otherwise a chunked upload
    // with no declared length would slip past and buffer unbounded. (The file
    // is still re-validated for real size + magic bytes downstream.)
    const rawLength = req.headers.get('content-length');
    const contentLength = Number(rawLength);
    if (
      rawLength === null ||
      !Number.isFinite(contentLength) ||
      contentLength > MAX_IMAGE_BYTES * 2
    ) {
      throw Errors.validationFailed('Image must be under 5 MB.');
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw Errors.validationFailed('Expected a `file` upload.');
    }
    // The action re-resolves the session: it needs the RLS-scoped storage
    // client for the upload and the quota read, not just the id `requireUserId`
    // returns. That second `getUser()` is accepted rather than widening the
    // action's contract — this path is rare and now capped at 5/min per user.
    const result = await uploadFeedbackScreenshotAction(file);
    return Response.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

import type { NextRequest } from 'next/server';
import { requireUserId } from '@/lib/api/auth';
import { labelImageIdSchema } from '@/lib/api/contracts/nutrition-label';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/core/errors/catalog';
import { createLabelImageUrl } from '@/lib/domain/nutrition/label-images/label-images';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * `GET /api/v1/nutrition-label/images/{imageId}` — a short-lived signed URL for
 * one of the caller's own stored label photos: `{ url, expiresAt }`.
 *
 * The photo lives in the private `nutrition-labels` bucket. Ownership is
 * checked on the row before anything is signed; another user's id, an unknown
 * id and a malformed one are all the same 404, so the route never confirms
 * that someone else's photo exists.
 *
 * Not premium-gated: the photo is the owner's own data.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const userId = await requireUserId();
    await assertRateLimit('labelImageView', { kind: 'user', value: userId });

    const parsed = labelImageIdSchema.safeParse((await params).imageId);
    if (!parsed.success) {
      throw Errors.notFound('Nutrition label image not found.');
    }

    return Response.json(await createLabelImageUrl(userId, parsed.data));
  } catch (error) {
    return handleRouteError(error);
  }
}

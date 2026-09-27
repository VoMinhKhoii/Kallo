import type { NextRequest } from 'next/server';
import { barcodeSearchQuerySchema } from '@/lib/api/contracts/barcode';
import { handleRouteError } from '@/lib/api/respond';
import { mapBarcodeServiceError } from '@/lib/domain/barcode/errors';
import { searchBarcodeProductForViewer } from '@/lib/domain/barcode/premium-scope';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * `GET /api/v1/barcode/search?code=<digits>` — look up a product by barcode
 * (local cache first, then Open Food Facts, caching the result). Returns
 * `{ product: ParsedBarcodeProduct }`, with micronutrients nulled for a
 * viewer without Premium; unknown barcodes are a 404 `BARCODE_NOT_FOUND`
 * envelope.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, profile } = await requireAuthAndProfile();
    const { code } = barcodeSearchQuerySchema.parse({
      code: req.nextUrl.searchParams.get('code') ?? undefined,
    });

    // Per-user cap before the Open Food Facts fan-out. The web share of this
    // surface (`searchBarcodeAction`) carries the same guard; the two clients
    // hit disjoint entry points, so neither double-counts the other.
    await assertRateLimit('barcodeSearch', { kind: 'user', value: user.id });

    const product = await searchBarcodeProductForViewer(code, {
      userId: user.id,
      profileCreatedAt: profile.createdAt,
    });
    return Response.json({ product });
  } catch (error) {
    return handleRouteError(mapBarcodeServiceError(error));
  }
}

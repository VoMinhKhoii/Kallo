import type { NextRequest } from 'next/server';
import { barcodeSearchQuerySchema } from '@/lib/api/contracts/barcode';
import { handleRouteError } from '@/lib/api/respond';
import { searchBarcodeProduct } from '@/lib/domain/barcode/service';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { mapBarcodeServiceError } from '../_errors';

export const runtime = 'nodejs';

/**
 * `GET /api/v1/barcode/search?code=<digits>` — look up a product by barcode
 * (local cache first, then Open Food Facts, caching the result). Returns
 * `{ product: ParsedBarcodeProduct }`; unknown barcodes are a 404
 * `BARCODE_NOT_FOUND` envelope.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuthAndProfile();
    const { code } = barcodeSearchQuerySchema.parse({
      code: req.nextUrl.searchParams.get('code') ?? undefined,
    });

    const product = await searchBarcodeProduct(code);
    return Response.json({ product });
  } catch (error) {
    return handleRouteError(mapBarcodeServiceError(error));
  }
}

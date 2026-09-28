import type { NextRequest } from 'next/server';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/core/errors/catalog';
import { barcodeSchema } from '@/lib/core/validation/barcode';
import { findCachedRow } from '@/lib/domain/barcode/cache';
import { fetchProductImage } from '@/lib/domain/barcode/image/image';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import { getRequestIp } from '@/lib/infra/security/request-ip';

/**
 * `GET /api/v1/barcode/image/{code}` — the front-of-pack photo of a product
 * already in our barcode store, fetched by our server so the provider never
 * sees who looked at it.
 *
 * Anonymous on purpose: a packaged product's photo is public data, and `<img>`
 * and Flutter's image cache carry no bearer token. It is not an open proxy:
 * only a barcode someone has already scanned has a row, the row's URL must be
 * on the provider's image host (re-checked in `fetchProductImage`), and the
 * body must be a small image. Everything else is one 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ip = getRequestIp(request);
    if (ip) await assertRateLimit('barcodeImageIp', { kind: 'ip', value: ip });

    const parsed = barcodeSchema.safeParse((await params).code);
    const row = parsed.success ? await findCachedRow(parsed.data) : undefined;
    const image = row?.imageUrl ? await fetchProductImage(row.imageUrl) : null;
    if (!image) throw Errors.notFound('Product image not found.');

    return new Response(image.body, {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

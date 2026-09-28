/**
 * Product photos, served through our own route so the provider never learns
 * which user looked at which product: the barcode doc promises that only the
 * digits of a lookup ever leave Kallo.
 *
 * Only a URL on the provider's image host is ever stored, and the proxy
 * re-checks the host before fetching, so a bad row can never turn the route
 * into a fetcher of arbitrary URLs.
 */
import { fetchWithTimeout } from '@/lib/core/async/fetch-with-timeout';

const TRUSTED_IMAGE_HOST = 'images.openfoodfacts.org';

/**
 * Bound on the upstream fetch. The OFF image CDN usually answers in under a
 * second but was measured at 6–20 s on a cold object; the photo loads lazily
 * beside an already-usable sheet, so a generous wait costs the user nothing.
 */
export const PRODUCT_IMAGE_TIMEOUT_MS = 10_000;

/** Larger bodies are refused rather than streamed: a front photo is ~50 KB. */
const MAX_IMAGE_BYTES = 2_000_000;

/**
 * Raster formats only. The bytes are served from OUR origin, and an SVG opened
 * directly there is a document that can run script — `image/*` would let one
 * through if the upstream ever answered with it.
 */
const RASTER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

/** The URL itself when it is an https photo on the trusted host, else null. */
export function trustedProductImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== TRUSTED_IMAGE_HOST) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/** The path clients load a product's photo from. */
export function barcodeImagePath(barcode: string): string {
  return `/api/v1/barcode/image/${barcode}`;
}

/**
 * Fetch a stored product photo. Null for anything that is not a small image
 * from the trusted host, so the caller can answer 404 without guessing why.
 */
export async function fetchProductImage(
  sourceUrl: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const url = trustedProductImageUrl(sourceUrl);
  if (!url) return null;

  try {
    const res = await fetchWithTimeout(
      (signal) =>
        fetch(url, {
          headers: {
            'User-Agent':
              'Kallo Meal Tracker - Version 1.0 - Contact: support@kallo.fit',
          },
          next: { revalidate: 604800 },
          // The host check above covers only the first hop; a followed
          // redirect could land anywhere. OFF serves photos directly, so a
          // 3xx is refused (it arrives as a non-ok response) rather than
          // chased.
          redirect: 'manual',
          signal,
        }),
      PRODUCT_IMAGE_TIMEOUT_MS,
      'product-image'
    );
    const contentType = (res.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!res.ok || !RASTER_IMAGE_TYPES.has(contentType)) return null;
    // Refuse an announced oversize body before buffering any of it.
    if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) {
      return null;
    }

    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return null;
    return { body, contentType };
  } catch (error) {
    console.error(`Error fetching product image ${url}:`, error);
    return null;
  }
}

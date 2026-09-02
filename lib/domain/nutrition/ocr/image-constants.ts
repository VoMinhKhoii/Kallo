export const OCR_SOURCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const OCR_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type OcrSourceImageMimeType = (typeof OCR_SOURCE_MIME_TYPES)[number];
export type OcrImageMimeType = (typeof OCR_UPLOAD_MIME_TYPES)[number];

export const OCR_MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/**
 * Longest base64 string that can encode `OCR_MAX_IMAGE_BYTES` (4 characters
 * per 3 bytes, padded up). A cheap `length` check against this rejects an
 * oversized payload BEFORE the schema's `/^[A-Za-z0-9+/]+={0,2}$/` walks it —
 * the regex over a 6 MiB string is the CPU cost, and it is spent on exactly
 * the input we already know we will refuse.
 */
export const OCR_MAX_IMAGE_BASE64_CHARS =
  Math.ceil(OCR_MAX_IMAGE_BYTES / 3) * 4;

/**
 * Byte ceiling for a `POST /nutrition-label/scan` request body: the base64
 * payload (inflating the image 4/3) plus room for the JSON framing — the field
 * names, quotes and the `mimeType` value. Derived from the image cap rather
 * than written as a separate number so raising one cannot silently strand the
 * other.
 */
export const OCR_MAX_BODY_BYTES =
  Math.ceil((OCR_MAX_IMAGE_BYTES * 4) / 3) + 4096;
export const OCR_MAX_SOURCE_FILE_BYTES = 12 * 1024 * 1024;
export const OCR_CLIENT_RESIZE_WIDTH = 1600;
export const OCR_MAX_IMAGE_DIMENSION = 8192;
export const OCR_MAX_IMAGE_PIXELS = 40_000_000;

export function isOcrSourceImageMimeType(
  value: string
): value is OcrSourceImageMimeType {
  return OCR_SOURCE_MIME_TYPES.some((mimeType) => mimeType === value);
}

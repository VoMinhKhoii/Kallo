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
export const OCR_MAX_SOURCE_FILE_BYTES = 12 * 1024 * 1024;
export const OCR_CLIENT_RESIZE_WIDTH = 1600;
export const OCR_MAX_IMAGE_DIMENSION = 8192;
export const OCR_MAX_IMAGE_PIXELS = 40_000_000;

export function isOcrSourceImageMimeType(
  value: string
): value is OcrSourceImageMimeType {
  return OCR_SOURCE_MIME_TYPES.some((mimeType) => mimeType === value);
}

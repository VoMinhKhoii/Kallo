export const OCR_ACCEPTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type OcrImageMimeType = (typeof OCR_ACCEPTED_MIME_TYPES)[number];

export const OCR_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const OCR_MAX_SOURCE_FILE_BYTES = 12 * 1024 * 1024;
export const OCR_CLIENT_RESIZE_WIDTH = 1600;
export const OCR_MAX_IMAGE_DIMENSION = 8192;
export const OCR_MAX_IMAGE_PIXELS = 40_000_000;

export function isOcrImageMimeType(value: string): value is OcrImageMimeType {
  return OCR_ACCEPTED_MIME_TYPES.some((mimeType) => mimeType === value);
}

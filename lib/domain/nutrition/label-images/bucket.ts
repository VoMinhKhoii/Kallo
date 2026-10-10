import type { OcrImageMimeType } from '@/lib/domain/nutrition/ocr/image-constants';
import type { StorageBucket } from '@/lib/infra/storage/object-storage';

/**
 * Where kept nutrition-label photos live: the PRIVATE `nutrition-labels`
 * R2 bucket, one object per scan at `{userId}/{scanId}.{ext}`. Account deletion purges the `{userId}/`
 * prefix, which is why the owner's id must stay the first path segment.
 */
export const NUTRITION_LABEL_BUCKET =
  'nutrition-labels' satisfies StorageBucket;

/** Lifetime of the owner's presigned view URL. */
export const LABEL_IMAGE_URL_TTL_SECONDS = 10 * 60;

const EXTENSIONS: Record<OcrImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function labelImagePath(
  userId: string,
  imageId: string,
  mimeType: OcrImageMimeType
): string {
  return `${userId}/${imageId}.${EXTENSIONS[mimeType]}`;
}

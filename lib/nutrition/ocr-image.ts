import sharp, { type Metadata } from 'sharp';
import {
  OCR_MAX_IMAGE_BYTES,
  OCR_MAX_IMAGE_DIMENSION,
  OCR_MAX_IMAGE_PIXELS,
  type OcrImageMimeType,
} from '@/lib/nutrition/ocr-image-constants';

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx']);
const HEIF_BRANDS = new Set(['heif', 'mif1', 'msf1']);

export class NutritionOcrImageError extends Error {
  readonly code = 'invalid_image';
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + 4));
}

function detectIsoBmffMime(bytes: Uint8Array): OcrImageMimeType | null {
  if (bytes.length < 16 || ascii(bytes, 4) !== 'ftyp') return null;

  const boxSize = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(0);
  const end = Math.min(bytes.length, boxSize || bytes.length);
  const brands = [ascii(bytes, 8)];
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(ascii(bytes, offset));
  }

  if (brands.some((brand) => HEIC_BRANDS.has(brand))) return 'image/heic';
  if (brands.some((brand) => HEIF_BRANDS.has(brand))) return 'image/heif';
  return null;
}

export function detectOcrImageMime(bytes: Uint8Array): OcrImageMimeType | null {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0) === 'RIFF' &&
    ascii(bytes, 8) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return detectIsoBmffMime(bytes);
}

export async function validateNutritionLabelImage(input: {
  imageBase64: string;
  mimeType: OcrImageMimeType;
}): Promise<void> {
  const bytes = Buffer.from(input.imageBase64, 'base64');
  if (bytes.length === 0 || bytes.length > OCR_MAX_IMAGE_BYTES) {
    throw new NutritionOcrImageError(
      'Image byte size is outside the accepted range'
    );
  }

  const detectedMime = detectOcrImageMime(bytes);
  const isCompatibleHeifDeclaration =
    detectedMime === 'image/heic' && input.mimeType === 'image/heif';
  if (detectedMime !== input.mimeType && !isCompatibleHeifDeclaration) {
    throw new NutritionOcrImageError(
      'Declared image type does not match its magic bytes'
    );
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: OCR_MAX_IMAGE_PIXELS,
    }).metadata();
  } catch (error) {
    throw new NutritionOcrImageError('Image bytes could not be decoded', {
      cause: error,
    });
  }
  const { width, height } = metadata;
  if (
    !width ||
    !height ||
    width < 32 ||
    height < 32 ||
    width > OCR_MAX_IMAGE_DIMENSION ||
    height > OCR_MAX_IMAGE_DIMENSION ||
    width * height > OCR_MAX_IMAGE_PIXELS
  ) {
    throw new NutritionOcrImageError(
      'Image dimensions are outside the accepted range'
    );
  }
}

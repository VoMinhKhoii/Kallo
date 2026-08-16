import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  detectOcrImageMime,
  NutritionOcrImageError,
  validateNutritionLabelImage,
} from '@/lib/nutrition/ocr-image';

async function image(format: 'jpeg' | 'png' | 'webp', size = 64) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: '#ffffff',
    },
  })
    [format]()
    .toBuffer();
}

describe('nutrition OCR image validation', () => {
  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
  ] as const)('accepts valid %s bytes', async (format, mimeType) => {
    const bytes = await image(format);
    expect(detectOcrImageMime(bytes)).toBe(mimeType);
    await expect(
      validateNutritionLabelImage({
        imageBase64: bytes.toString('base64'),
        mimeType,
      })
    ).resolves.toBeUndefined();
  });

  it('does not advertise ISO-BMFF formats to the server decoder', () => {
    const bmff = (brand: string) =>
      Buffer.concat([
        Buffer.from([0, 0, 0, 20]),
        Buffer.from('ftyp'),
        Buffer.from(brand),
        Buffer.alloc(4),
      ]);
    expect(detectOcrImageMime(bmff('heic'))).toBeNull();
    expect(detectOcrImageMime(bmff('mif1'))).toBeNull();
    expect(detectOcrImageMime(bmff('avif'))).toBeNull();
  });

  it('rejects a MIME spoof and unsafe dimensions', async () => {
    const png = await image('png');
    await expect(
      validateNutritionLabelImage({
        imageBase64: png.toString('base64'),
        mimeType: 'image/jpeg',
      })
    ).rejects.toBeInstanceOf(NutritionOcrImageError);

    const tinyPng = await image('png', 16);
    await expect(
      validateNutritionLabelImage({
        imageBase64: tinyPng.toString('base64'),
        mimeType: 'image/png',
      })
    ).rejects.toMatchObject({ code: 'invalid_image' });
  });
});

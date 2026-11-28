import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  detectOcrImageMime,
  NutritionOcrImageError,
  prepareOcrImageForModel,
  validateNutritionLabelImage,
} from '@/lib/domain/nutrition/ocr/image';

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

  it('wraps corrupt pixel decode errors from prepareOcrImageForModel as invalid_image', async () => {
    const corrupt = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    await expect(
      prepareOcrImageForModel({
        imageBase64: corrupt.toString('base64'),
        mimeType: 'image/jpeg',
      })
    ).rejects.toMatchObject({
      name: 'Error',
      code: 'invalid_image',
    });
  });

  it('flattens transparent PNGs onto a white background before JPEG encoding', async () => {
    const transparentPng = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const prepared = await prepareOcrImageForModel({
      imageBase64: transparentPng.toString('base64'),
      mimeType: 'image/png',
    });
    expect(prepared.mimeType).toBe('image/jpeg');
    const { data } = await sharp(Buffer.from(prepared.imageBase64, 'base64'))
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Center pixel must be white (flattened), not black
    expect(data[0]).toBeGreaterThan(240);
    expect(data[1]).toBeGreaterThan(240);
    expect(data[2]).toBeGreaterThan(240);
  });
});

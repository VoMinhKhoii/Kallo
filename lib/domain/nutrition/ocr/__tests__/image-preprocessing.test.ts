import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  assessNutritionLabelQuality,
  preprocessNutritionLabelBuffer,
} from '../image-preprocessing';

describe('preprocessNutritionLabelBuffer', () => {
  it('resizes images exceeding max width and applies contrast/sharpening', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await preprocessNutritionLabelBuffer({
      buffer: inputBuffer,
      mimeType: 'image/jpeg',
    });

    expect(result.width).toBeLessThanOrEqual(1600);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.base64.length).toBeGreaterThan(0);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.processedMs).toBeGreaterThanOrEqual(0);
  });

  it('preserves PNG format when input mimeType is PNG', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 100, g: 150, b: 200, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await preprocessNutritionLabelBuffer({
      buffer: inputBuffer,
      mimeType: 'image/png',
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(500);
  });
});

describe('assessNutritionLabelQuality', () => {
  it('returns scannable true for valid dimensions', async () => {
    const validBuffer = await sharp({
      create: {
        width: 600,
        height: 800,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const assessment = await assessNutritionLabelQuality(validBuffer);
    expect(assessment.isScannable).toBe(true);
    expect(assessment.width).toBe(600);
    expect(assessment.height).toBe(800);
  });

  it('returns scannable false for undersized images', async () => {
    const tinyBuffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const assessment = await assessNutritionLabelQuality(tinyBuffer);
    expect(assessment.isScannable).toBe(false);
    expect(assessment.reason).toContain('outside allowable range');
  });

  it('returns scannable false for corrupt bytes', async () => {
    const corruptBuffer = Buffer.from('not an image', 'utf-8');
    const assessment = await assessNutritionLabelQuality(corruptBuffer);
    expect(assessment.isScannable).toBe(false);
  });
});

import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';

const LIVE_OCR_MODEL = 'gemini-3.1-flash-lite';

const fixtures = [
  {
    name: 'English per-serving label',
    file: new URL('./fixtures/nutrition-label-en.svg', import.meta.url),
    expected: {
      basis: 'per_serving' as const,
      values: {
        calories: 210,
        proteinGrams: 5,
        carbsGrams: 30,
        fatGrams: 8,
        sodiumMg: 180,
      },
    },
  },
  {
    name: 'Vietnamese per-100ml label with comma decimals and kJ',
    file: new URL('./fixtures/nutrition-label-vi.svg', import.meta.url),
    expected: {
      basis: 'per_100ml' as const,
      values: {
        calories: 210 / 4.184,
        proteinGrams: 3.5,
        carbsGrams: 4.8,
        fatGrams: 1.5,
        sodiumMg: 120,
      },
    },
  },
];

describe('Live Nutrition Label OCR extraction', () => {
  it.skipIf(process.env.RUN_LIVE_OCR_TESTS !== 'true').each(fixtures)(
    'extracts exact normalized values from $name',
    async ({ file, expected }) => {
      const fixture = await readFile(file);
      const base64Data = (await sharp(fixture).png().toBuffer()).toString(
        'base64'
      );
      const result = await scanNutritionLabelWithGemini({
        imageBase64: base64Data,
        mimeType: 'image/png',
        model: LIVE_OCR_MODEL,
      });

      expect(result.basis).toBe(expected.basis);
      const values =
        result.basis === 'per_serving'
          ? result.perServing
          : result.basis === 'per_100ml'
            ? result.per100ml
            : null;
      expect(values).not.toBeNull();
      expect(values).toMatchObject(expected.values);
    },
    30_000
  );
});

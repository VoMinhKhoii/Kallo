import { describe, expect, it } from 'vitest';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr';

describe('Live Nutrition Label OCR extraction', () => {
  it.skipIf(!process.env.RUN_LIVE_OCR_TESTS)(
    'extracts values from real images',
    async () => {
      // Standard sample nutrition label
      const url =
        'https://upload.wikimedia.org/wikipedia/commons/0/07/Nutrition_Facts.jpg';

      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
      const arrayBuffer = await res.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

      const result = await scanNutritionLabelWithGemini({
        imageBase64: base64Data,
        mimeType: 'image/jpeg',
      });

      console.log('Live OCR Result:', JSON.stringify(result, null, 2));

      expect(result.perServing?.calories).toBeGreaterThan(0);
      expect(result.confidence).toBe('high');
    },
    30000
  );
});

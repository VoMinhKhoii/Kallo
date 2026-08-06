import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr';

describe('Live Nutrition Label OCR extraction', () => {
  it('extracts values from real images', async () => {
    // Standard sample nutrition label (Skittles)
    const url =
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Skittles-Nutrition-Facts.jpg/440px-Skittles-Nutrition-Facts.jpg';

    const res = await fetch(url);
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
  }, 30000);
});

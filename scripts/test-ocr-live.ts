import '@/lib/__test-utils__/server-only-shim';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr';

const SAMPLE_URLS = [
  {
    name: 'Skittles (Red Bag)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Skittles-Nutrition-Facts.jpg',
  },
];

async function runTest() {
  console.log('--- OCR Live Extraction Test ---');
  for (const item of SAMPLE_URLS) {
    try {
      console.log(`\nFetching ${item.name}...`);
      const res = await fetch(item.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!res.ok) {
        console.error(`Failed to fetch ${item.url}: ${res.statusText}`);
        continue;
      }
      const arrayBuffer = await res.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = res.headers.get('content-type') || 'image/jpeg';

      console.log(`Running Gemini OCR for ${item.name}...`);
      const result = await scanNutritionLabelWithGemini({
        imageBase64: base64Data,
        mimeType,
      });

      console.log(`\n✅ Result for ${item.name}:`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`❌ Error testing ${item.name}:`, err);
    }
  }
}

if (process.argv[1]?.includes('test-ocr-live')) {
  runTest();
}

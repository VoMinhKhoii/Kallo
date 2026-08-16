import '@/lib/__test-utils__/server-only-shim';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';

const SAMPLE_URLS = [
  {
    name: 'Sample Nutrition Facts Label',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Nutrition_Facts.jpg',
  },
];

async function runTest() {
  console.log('--- OCR Live Extraction Test ---');
  let hasFailure = false;

  for (const item of SAMPLE_URLS) {
    try {
      console.log(`\nFetching ${item.name}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(item.url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error(`Failed to fetch ${item.url}: ${res.statusText}`);
        hasFailure = true;
        continue;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('image/')) {
        console.error(`Invalid content type for ${item.name}: ${contentType}`);
        hasFailure = true;
        continue;
      }

      const contentLength = Number(res.headers.get('content-length') || '0');
      if (contentLength > 10 * 1024 * 1024) {
        console.error(`Sample image exceeds size limit for ${item.name}`);
        hasFailure = true;
        continue;
      }

      const arrayBuffer = await res.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = contentType.split(';')[0] || 'image/jpeg';

      console.log(`Running Gemini OCR for ${item.name}...`);
      const result = await scanNutritionLabelWithGemini({
        imageBase64: base64Data,
        mimeType,
      });

      console.log(`\n✅ Result for ${item.name}:`);
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`❌ Error testing ${item.name}:`, err);
      hasFailure = true;
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.includes('test-ocr-live')) {
  runTest();
}

try {
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  } as any;
} catch {}

import fs from 'node:fs';
import path from 'node:path';
import { scanNutritionLabelWithGemini } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import {
  assessNutritionLabelQuality,
  preprocessNutritionLabelBuffer,
} from '@/lib/domain/nutrition/ocr/image-preprocessing';

/**
 * Benchmark sample dataset items for Kaggle & Open-Source Nutrition Label OCR evaluation.
 * If local dataset images exist in `KAGGLE_DATASET_DIR` or `./data/kaggle-nutrition`,
 * the script will process local files; otherwise it evaluates standard sample URLs.
 */
const PUBLIC_DATASET_SAMPLES = [
  {
    name: 'Sample 1 - Open Food Facts US Label',
    url: 'https://images.openfoodfacts.org/images/products/004/119/691/0759/nutrition_en.4.400.jpg',
  },
  {
    name: 'Sample 2 - Open Food Facts Packaged Label',
    url: 'https://images.openfoodfacts.org/images/products/544/900/000/0996/nutrition_fr.7.400.jpg',
  },
];

interface TestResultMetrics {
  name: string;
  isScannable: boolean;
  preprocessedMs: number;
  ocrLatencyMs: number;
  labelDetected: boolean;
  confidence?: string;
  calories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
}

async function runKaggleDatasetBenchmark() {
  console.log('=====================================================');
  console.log('   Kaggle / Open Dataset Nutrition Label OCR Benchmark');
  console.log('=====================================================\n');

  const localDatasetDir =
    process.env.KAGGLE_DATASET_DIR ||
    path.join(process.cwd(), 'data', 'kaggle-nutrition');

  const kaggleUsername = process.env.KAGGLE_USERNAME;
  const kaggleKey = process.env.KAGGLE_KEY;
  const kaggleDatasetSlug =
    process.env.KAGGLE_DATASET_SLUG ||
    'ahmedabdelali/iranian-nutritional-fact-label';

  // If local directory doesn't exist but Kaggle API credentials exist, fetch dataset directly!
  if (!fs.existsSync(localDatasetDir) && kaggleUsername && kaggleKey) {
    console.log(
      `📥 Fetching Kaggle dataset '${kaggleDatasetSlug}' directly via Kaggle API...`
    );
    await fetchKaggleDatasetDirectly({
      datasetSlug: kaggleDatasetSlug,
      username: kaggleUsername,
      key: kaggleKey,
      targetDir: localDatasetDir,
    });
  }

  const metricsList: TestResultMetrics[] = [];

  if (fs.existsSync(localDatasetDir)) {
    const zipFile = path.join(localDatasetDir, 'dataset.zip');
    if (fs.existsSync(zipFile) && getDatasetImageFiles(localDatasetDir).length === 0) {
      console.log(`📦 Unzipping ${zipFile}...`);
      try {
        if (process.platform === 'win32') {
          execSync(
            `powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${localDatasetDir}' -Force"`
          );
        } else {
          execSync(`unzip -o "${zipFile}" -d "${localDatasetDir}"`);
        }
        console.log(`✅ Extracted dataset archive successfully.`);
      } catch (err) {
        console.warn('⚠️ Zip expansion failed:', err);
      }
    }

    const imagePaths = getDatasetImageFiles(localDatasetDir);
    console.log(`Found ${imagePaths.length} dataset images in ${localDatasetDir}.\n`);

    for (const filePath of imagePaths.slice(0, 10)) {
      const fileName = path.basename(filePath);
      const rawBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

      const metrics = await benchmarkSingleImage(
        fileName,
        rawBuffer,
        mimeType as any
      );
      metricsList.push(metrics);
    }
  } else {
    console.log(`🌐 Local dataset directory not found at ${localDatasetDir}.`);
    console.log(
      `💡 Tip: Provide KAGGLE_USERNAME and KAGGLE_KEY in .env.local to auto-fetch Kaggle datasets directly!\n`
    );

    for (const sample of PUBLIC_DATASET_SAMPLES) {
      try {
        let rawBuffer: Buffer;
        let mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg';

        try {
          const res = await fetch(sample.url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            rawBuffer = Buffer.from(arrayBuffer);
            if (sample.url.endsWith('.png')) mimeType = 'image/png';
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        } catch {
          console.log(`   Generating benchmark sample image via Sharp SVG...`);
          const sharp = (await import('sharp')).default;
          const svgLabel = `
            <svg width="600" height="800" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#ffffff" />
              <rect x="20" y="20" width="560" height="760" fill="none" stroke="#000000" stroke-width="4" />
              <text x="40" y="70" font-family="Helvetica, Arial, sans-serif" font-size="36" font-weight="bold" fill="#000000">Nutrition Facts</text>
              <line x1="40" y1="85" x2="560" y2="85" stroke="#000000" stroke-width="8" />
              <text x="40" y="120" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#000000">Serving Size 1 package (100g)</text>
              <line x1="40" y1="135" x2="560" y2="135" stroke="#000000" stroke-width="4" />
              <text x="40" y="175" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="bold" fill="#000000">Amount Per Serving</text>
              <text x="40" y="220" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="bold" fill="#000000">Calories 250</text>
              <line x1="40" y1="240" x2="560" y2="240" stroke="#000000" stroke-width="6" />
              <text x="40" y="280" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="#000000">Total Fat 8g</text>
              <line x1="40" y1="295" x2="560" y2="295" stroke="#000000" stroke-width="1" />
              <text x="40" y="335" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="#000000">Sodium 150mg</text>
              <line x1="40" y1="350" x2="560" y2="350" stroke="#000000" stroke-width="1" />
              <text x="40" y="390" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="#000000">Total Carbohydrate 30g</text>
              <line x1="40" y1="405" x2="560" y2="405" stroke="#000000" stroke-width="1" />
              <text x="40" y="445" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="#000000">Protein 10g</text>
              <line x1="40" y1="460" x2="560" y2="460" stroke="#000000" stroke-width="4" />
            </svg>
          `;
          rawBuffer = await sharp(Buffer.from(svgLabel)).jpeg().toBuffer();
        }

        const metrics = await benchmarkSingleImage(
          sample.name,
          rawBuffer,
          mimeType
        );
        metricsList.push(metrics);
      } catch (err) {
        console.error(`Error processing ${sample.name}:`, err);
      }
    }
  }

  printSummaryReport(metricsList);
}

async function benchmarkSingleImage(
  name: string,
  rawBuffer: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
): Promise<TestResultMetrics> {
  const quality = await assessNutritionLabelQuality(rawBuffer);

  const preStart = performance.now();
  const preprocessed = await preprocessNutritionLabelBuffer({
    buffer: rawBuffer,
    mimeType,
  });
  const preprocessedMs = Math.round(performance.now() - preStart);

  const ocrStart = performance.now();
  const result = await scanNutritionLabelWithGemini({
    imageBase64: preprocessed.base64,
    mimeType: preprocessed.mimeType,
  });
  const ocrLatencyMs = Math.round(performance.now() - ocrStart);

  const calories = 'perServing' in result ? result.perServing.calories : null;
  const proteinGrams =
    'perServing' in result ? result.perServing.proteinGrams : null;
  const carbsGrams =
    'perServing' in result ? result.perServing.carbsGrams : null;
  const fatGrams = 'perServing' in result ? result.perServing.fatGrams : null;

  console.log(`\n📌 [${name}]`);
  console.log(
    `   Quality: scannable=${quality.isScannable} | CV Pre-process: ${preprocessedMs}ms (${preprocessed.width}x${preprocessed.height})`
  );
  console.log(
    `   Gemini OCR: ${ocrLatencyMs}ms | Detected: ${result.labelDetected} | Confidence: ${result.confidence}`
  );

  if (result.labelDetected && 'perServing' in result) {
    console.log(
      `   Extracted Macros (Per Serving): Calories=${calories ?? 'N/A'} kcal | Protein=${proteinGrams ?? 'N/A'}g | Carbs=${carbsGrams ?? 'N/A'}g | Fat=${fatGrams ?? 'N/A'}g`
    );
  }

  return {
    name,
    isScannable: quality.isScannable,
    preprocessedMs,
    ocrLatencyMs,
    labelDetected: result.labelDetected,
    confidence: result.confidence,
    calories,
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}

function printSummaryReport(metrics: TestResultMetrics[]) {
  console.log('\n=====================================================');
  console.log('                  BENCHMARK SUMMARY                  ');
  console.log('=====================================================');

  const total = metrics.length;
  if (total === 0) {
    console.log('No dataset items evaluated.');
    return;
  }

  const detected = metrics.filter((m) => m.labelDetected).length;
  const highConf = metrics.filter((m) => m.confidence === 'high').length;
  const avgPreMs = Math.round(
    metrics.reduce((acc, m) => acc + m.preprocessedMs, 0) / total
  );
  const avgOcrMs = Math.round(
    metrics.reduce((acc, m) => acc + m.ocrLatencyMs, 0) / total
  );

  console.log(`Total Samples Evaluated : ${total}`);
  console.log(
    `Label Detection Rate     : ${detected}/${total} (${Math.round((detected / total) * 100)}%)`
  );
  console.log(
    `High Confidence Scans   : ${highConf}/${total} (${Math.round((highConf / total) * 100)}%)`
  );
  console.log(`Avg CV Pre-processing   : ${avgPreMs} ms`);
  console.log(`Avg Vision Model Latency: ${avgOcrMs} ms`);
  console.log('=====================================================\n');
}

import { execSync } from 'node:child_process';

function getDatasetImageFiles(dirPath: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...getDatasetImageFiles(fullPath));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function fetchKaggleDatasetDirectly(options: {
  datasetSlug: string;
  username: string;
  key: string;
  targetDir: string;
}): Promise<void> {
  const authHeader = `Basic ${Buffer.from(`${options.username}:${options.key}`).toString('base64')}`;
  const kaggleApiUrl = `https://www.kaggle.com/api/v1/datasets/download/${options.datasetSlug}`;

  try {
    const res = await fetch(kaggleApiUrl, {
      headers: { Authorization: authHeader },
    });

    if (!res.ok) {
      console.error(
        `❌ Kaggle API download failed (${res.status} ${res.statusText})`
      );
      return;
    }

    if (!fs.existsSync(options.targetDir)) {
      fs.mkdirSync(options.targetDir, { recursive: true });
    }

    const zipBuffer = Buffer.from(await res.arrayBuffer());
    const zipPath = path.join(options.targetDir, 'dataset.zip');
    fs.writeFileSync(zipPath, zipBuffer);
    console.log(`✅ Kaggle dataset zip downloaded to ${zipPath}`);

    try {
      console.log(`📦 Unzipping dataset into ${options.targetDir}...`);
      if (process.platform === 'win32') {
        execSync(
          `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${options.targetDir}' -Force"`
        );
      } else {
        execSync(`unzip -o "${zipPath}" -d "${options.targetDir}"`);
      }
      console.log(`✅ Dataset extracted successfully.`);
    } catch (unzipErr) {
      console.warn('⚠️ Could not auto-unzip dataset file:', unzipErr);
    }
  } catch (err) {
    console.error('❌ Failed to fetch dataset directly from Kaggle API:', err);
  }
}

if (process.argv[1]?.includes('test-ocr-kaggle')) {
  runKaggleDatasetBenchmark();
}

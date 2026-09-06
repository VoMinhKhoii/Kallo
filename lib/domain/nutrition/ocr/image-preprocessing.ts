import sharp from 'sharp';
import {
  OCR_CLIENT_RESIZE_WIDTH,
  OCR_MAX_IMAGE_BYTES,
  OCR_MAX_IMAGE_DIMENSION,
  OCR_MAX_IMAGE_PIXELS,
  type OcrImageMimeType,
} from '@/lib/domain/nutrition/ocr/image-constants';

export interface PreprocessedImageResult {
  buffer: Buffer;
  base64: string;
  mimeType: OcrImageMimeType;
  width: number;
  height: number;
  processedMs: number;
}

export interface ImageQualityAssessment {
  isScannable: boolean;
  reason?: string;
  width?: number;
  height?: number;
}

/**
 * Pre-processes an image buffer for optimal Nutrition Label OCR vision extraction.
 *
 * Operations applied:
 * 1. Auto-rotates using EXIF orientation tags (.rotate()).
 * 2. Downscales if width > OCR_CLIENT_RESIZE_WIDTH (1600px) to bound CPU/RAM.
 * 3. Applies histogram normalization (.normalize()) to enhance low-contrast labels.
 * 4. Applies conservative sharpening (.sharpen({ sigma: 1.0 })) to clarify text edges.
 * 5. Re-encodes to high-quality JPEG or PNG.
 */
export async function preprocessNutritionLabelBuffer(input: {
  buffer: Buffer;
  mimeType: OcrImageMimeType;
}): Promise<PreprocessedImageResult> {
  const startTime = performance.now();

  let pipeline = sharp(input.buffer, {
    failOn: 'error',
    limitInputPixels: OCR_MAX_IMAGE_PIXELS,
  }).rotate();

  const metadata = await pipeline.metadata();
  const rawWidth = metadata.width ?? 0;
  const rawHeight = metadata.height ?? 0;

  if (rawWidth > OCR_CLIENT_RESIZE_WIDTH) {
    pipeline = pipeline.resize({
      width: OCR_CLIENT_RESIZE_WIDTH,
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  pipeline = pipeline.normalize().sharpen({ sigma: 1.0 });

  let processedBuffer: Buffer;
  let targetMime: OcrImageMimeType = input.mimeType;

  if (input.mimeType === 'image/png') {
    processedBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
  } else {
    targetMime = 'image/jpeg';
    processedBuffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
  }

  // Safety fallback if processed buffer exceeds size ceiling
  if (processedBuffer.length > OCR_MAX_IMAGE_BYTES) {
    processedBuffer = await sharp(input.buffer)
      .rotate()
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  const finalMetadata = await sharp(processedBuffer).metadata();
  const processedMs = Math.round(performance.now() - startTime);

  return {
    buffer: processedBuffer,
    base64: processedBuffer.toString('base64'),
    mimeType: targetMime,
    width: finalMetadata.width ?? rawWidth,
    height: finalMetadata.height ?? rawHeight,
    processedMs,
  };
}

/**
 * Assesses whether an image buffer meets minimal scannability standards before LLM API invocation.
 */
export async function assessNutritionLabelQuality(
  buffer: Buffer
): Promise<ImageQualityAssessment> {
  try {
    const metadata = await sharp(buffer, {
      limitInputPixels: OCR_MAX_IMAGE_PIXELS,
    }).metadata();

    const { width, height } = metadata;
    if (
      !width ||
      !height ||
      width < 32 ||
      height < 32 ||
      width > OCR_MAX_IMAGE_DIMENSION ||
      height > OCR_MAX_IMAGE_DIMENSION
    ) {
      return {
        isScannable: false,
        reason: 'Image dimensions outside allowable range',
        width,
        height,
      };
    }

    return { isScannable: true, width, height };
  } catch (error) {
    return {
      isScannable: false,
      reason:
        error instanceof Error ? error.message : 'Unreadable image stream',
    };
  }
}

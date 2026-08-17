'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { scanNutritionLabelAction } from '@/lib/actions/logging/nutrition-ocr';
import {
  isOcrSourceImageMimeType,
  OCR_CLIENT_RESIZE_WIDTH,
  OCR_MAX_IMAGE_BYTES,
  OCR_MAX_SOURCE_FILE_BYTES,
} from '@/lib/domain/nutrition/ocr-image-constants';
import type {
  OcrErrorCode,
  ParsedNutritionLabel,
} from '@/lib/domain/nutrition/ocr-schema';

const ENCODE_ATTEMPTS = [
  { quality: 0.85, scale: 1 },
  { quality: 0.7, scale: 1 },
  { quality: 0.6, scale: 0.8 },
  { quality: 0.5, scale: 0.65 },
] as const;

class OcrImageEnvironmentError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Image compression produced no data')),
      'image/jpeg',
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read compressed image'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.includes(',')) {
        reject(new Error('Invalid compressed image data'));
        return;
      }
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function compressNutritionLabelImage(file: File): Promise<{
  base64Data: string;
  mimeType: string;
}> {
  if (
    file.size === 0 ||
    file.size > OCR_MAX_SOURCE_FILE_BYTES ||
    !isOcrSourceImageMimeType(file.type)
  ) {
    throw new Error('Image file is too large, empty, or unsupported');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new OcrImageEnvironmentError(
      'This browser cannot safely resize images'
    );
  }

  let bitmap: ImageBitmap;
  try {
    // Resize during decode so a high-resolution phone photo is never expanded
    // into a full-size RGBA bitmap in page memory.
    bitmap = await createImageBitmap(file, {
      resizeWidth: OCR_CLIENT_RESIZE_WIDTH,
      resizeQuality: 'high',
    });
  } catch (error) {
    throw new Error('Failed to decode image', { cause: error });
  }

  try {
    if (bitmap.width < 32 || bitmap.height < 32 || bitmap.height > 4096) {
      throw new Error('Image dimensions are outside the accepted range');
    }

    const source = document.createElement('canvas');
    source.width = bitmap.width;
    source.height = bitmap.height;
    const context = source.getContext('2d');
    if (!context) {
      throw new OcrImageEnvironmentError('Canvas context unavailable');
    }
    context.drawImage(bitmap, 0, 0);

    for (const attempt of ENCODE_ATTEMPTS) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(source.width * attempt.scale);
      canvas.height = Math.round(source.height * attempt.scale);
      const outputContext = canvas.getContext('2d');
      if (!outputContext) {
        throw new OcrImageEnvironmentError('Canvas context unavailable');
      }
      outputContext.drawImage(source, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToBlob(canvas, attempt.quality);
      if (blob.size <= OCR_MAX_IMAGE_BYTES) {
        return {
          base64Data: await blobToBase64(blob),
          mimeType: 'image/jpeg',
        };
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error('Compressed image exceeds the upload budget');
}

export function useNutritionOcr() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorCode, setErrorCode] = useState<OcrErrorCode | null>(null);

  const mutation = useMutation<ParsedNutritionLabel, Error, File>({
    mutationFn: async (file: File) => {
      setErrorCode(null);
      setIsCompressing(true);

      let compressed: Awaited<ReturnType<typeof compressNutritionLabelImage>>;
      try {
        compressed = await compressNutritionLabelImage(file);
      } catch (error) {
        setErrorCode(
          error instanceof OcrImageEnvironmentError
            ? 'server_error'
            : 'invalid_image'
        );
        throw error;
      } finally {
        setIsCompressing(false);
      }

      let result: Awaited<ReturnType<typeof scanNutritionLabelAction>>;
      try {
        result = await scanNutritionLabelAction({
          imageBase64: compressed.base64Data,
          mimeType: compressed.mimeType,
        });
      } catch (error) {
        setErrorCode('server_error');
        throw error;
      }

      if (!result.success) {
        setErrorCode(result.code);
        throw new Error(result.code);
      }

      return result.data;
    },
  });

  return {
    scanLabel: mutation.mutateAsync,
    isScanning: mutation.isPending,
    isCompressing,
    data: mutation.data ?? null,
    error: errorCode,
    resetError: () => {
      setErrorCode(null);
      mutation.reset();
    },
  };
}

'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { scanNutritionLabelAction } from '@/lib/actions/nutrition-ocr';
import type {
  OcrErrorCode,
  ParsedNutritionLabel,
} from '@/lib/nutrition/ocr-schema';

export async function compressNutritionLabelImage(file: File): Promise<{
  base64Data: string;
  mimeType: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.onload = () => {
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Always re-encode lossily; PNG ignores quality argument and inflates payload.
        const targetMime =
          file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(targetMime, 0.85);
        const base64Data = dataUrl.split(',')[1];
        resolve({ base64Data, mimeType: targetMime });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function useNutritionOcr() {
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorCode, setErrorCode] = useState<OcrErrorCode | null>(null);

  const mutation = useMutation<ParsedNutritionLabel, Error, File>({
    mutationFn: async (file: File) => {
      setErrorCode(null);
      setIsCompressing(true);
      try {
        const { base64Data, mimeType } =
          await compressNutritionLabelImage(file);
        setIsCompressing(false);

        const result = await scanNutritionLabelAction({
          imageBase64: base64Data,
          mimeType,
        });

        if (!result.success) {
          setErrorCode(result.code);
          throw new Error(result.code);
        }

        return result.data;
      } catch (err) {
        setIsCompressing(false);
        throw err;
      }
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

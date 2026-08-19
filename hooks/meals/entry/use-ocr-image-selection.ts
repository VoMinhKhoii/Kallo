'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNutritionOcr } from '@/hooks/meals/entry/use-nutrition-ocr';
import type { ParsedNutritionLabel } from '@/lib/domain/nutrition/ocr/schema';

/**
 * Holding one label photo and sending it to be read.
 *
 * Split out of `ocr-scanner-tab.tsx`, which was mixing this lifecycle with the
 * camera/upload layout. Two things here are easy to get wrong and are the
 * reason it is one hook rather than loose state:
 *
 * - **Object URLs leak.** Every preview URL is revoked when it is replaced,
 *   cleared, or the component unmounts.
 * - **A scan can outlive its photo.** The generation counter bumps on every
 *   select, clear and unmount, so a result that lands after the user moved on
 *   is dropped instead of populating a review step for an image they replaced.
 */
export function useOcrImageSelection(
  onSuccess: (data: ParsedNutritionLabel) => void
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const scanGenerationRef = useRef(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { scanLabel, isCompressing, isScanning, error, resetError } =
    useNutritionOcr();

  useEffect(
    () => () => {
      scanGenerationRef.current += 1;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const selectImage = (file: File) => {
    scanGenerationRef.current += 1;
    resetError();
    setSelectedFile(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) selectImage(file);
  };

  const clearImage = () => {
    scanGenerationRef.current += 1;
    setSelectedFile(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    resetError();
  };

  const scan = async () => {
    if (!selectedFile) return;
    const scanGeneration = ++scanGenerationRef.current;
    try {
      const result = await scanLabel(selectedFile);
      if (scanGeneration === scanGenerationRef.current) onSuccess(result);
    } catch (scanError) {
      console.warn('Nutrition label scan failed:', scanError);
    }
  };

  return {
    fileInputRef,
    selectedFile,
    /** Only ever a blob:/data:image URL — anything else is not rendered. */
    previewUrl:
      previewUrl &&
      (previewUrl.startsWith('blob:') || previewUrl.startsWith('data:image/'))
        ? previewUrl
        : undefined,
    hasImage: previewUrl !== null,
    selectImage,
    handleFileSelect,
    clearImage,
    scan,
    error,
    isCompressing,
    isProcessing: isCompressing || isScanning,
  };
}

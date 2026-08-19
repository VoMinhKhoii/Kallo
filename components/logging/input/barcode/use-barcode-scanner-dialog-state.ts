'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { OcrReviewStep } from '@/components/logging/input/ocr/review/ocr-review-step';
import { useBarcodeCameraScanner } from '@/hooks/ui/use-barcode-camera-scanner';
import {
  searchBarcodeAction,
  stageBarcodeMealAction,
} from '@/lib/actions/logging/barcode';
import { stageOcrMealAction } from '@/lib/actions/logging/nutrition-ocr';
import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { tryDecodeFontEncodedBarcode } from '@/lib/domain/barcode/decode';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/openfoodfacts';
import type { ParsedNutritionLabel } from '@/lib/domain/nutrition/ocr/schema';

interface UseBarcodeScannerDialogStateProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

export function useBarcodeScannerDialogState({
  isOpen,
  onOpenChange,
  selectedDate,
  onSuccess,
}: UseBarcodeScannerDialogStateProps) {
  const t = useTranslations('logging');
  const [scanType, setScanType] = useState<'barcode' | 'ocr'>('barcode');
  const [step, setStep] = useState<'input' | 'quantity' | 'ocr-review'>(
    'input'
  );
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [barcode, setBarcode] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [product, setProduct] = useState<ParsedBarcodeProduct | null>(null);
  const [ocrData, setOcrData] = useState<ParsedNutritionLabel | null>(null);
  const [isStaging, setIsStaging] = useState(false);
  const scanGenerationRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  const isStagingRef = useRef(false);
  isOpenRef.current = isOpen;

  const runSearch = useCallback(
    async (rawBarcode: string) => {
      if (!isOpenRef.current) return null;
      const scanGeneration = ++scanGenerationRef.current;
      const sanitized = tryDecodeFontEncodedBarcode(rawBarcode);
      setBarcode(sanitized);
      setIsSearching(true);
      setSearchError(null);

      try {
        const res = await searchBarcodeAction({ barcode: sanitized });
        if (scanGeneration !== scanGenerationRef.current) return null;
        if (res.success) {
          setProduct(res.data);
          setStep('quantity');
          return true;
        }
        setSearchError(t(`barcodeError.${res.code}`));
        return false;
      } catch {
        if (scanGeneration !== scanGenerationRef.current) return null;
        setSearchError(t('barcodeError.server_error'));
        return false;
      } finally {
        if (scanGeneration === scanGenerationRef.current) {
          setIsSearching(false);
        }
      }
    },
    [t]
  );

  const handleDecode = useCallback(
    (decodedText: string) => {
      runSearch(decodedText).then((success) => {
        if (success === false) setScanMode('manual');
      });
    },
    [runSearch]
  );

  const {
    cameraStatus,
    cameras,
    selectedCameraId,
    effectiveCameraId,
    setSelectedCameraId,
    stopScanner,
  } = useBarcodeCameraScanner({
    isActive:
      isOpen &&
      step === 'input' &&
      scanType === 'barcode' &&
      scanMode === 'camera',
    onDecode: handleDecode,
  });

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;
    await runSearch(trimmed);
  };

  const closeDialog = useCallback(() => {
    scanGenerationRef.current += 1;
    isOpenRef.current = false;
    onOpenChange(false);
    stopScanner();
    setScanType('barcode');
    setStep('input');
    setScanMode('camera');
    setBarcode('');
    setSearchError(null);
    setIsSearching(false);
    setProduct(null);
    setOcrData(null);
    isStagingRef.current = false;
    setIsStaging(false);
  }, [onOpenChange, stopScanner]);

  const handleClose = useCallback(() => {
    if (isStagingRef.current) return;
    closeDialog();
  }, [closeDialog]);

  const handleScanTypeChange = useCallback((next: 'barcode' | 'ocr') => {
    scanGenerationRef.current += 1;
    setScanType(next);
    setSearchError(null);
    setIsSearching(false);
    setProduct(null);
    setOcrData(null);
    setStep('input');
  }, []);

  const executeStageAndSave = async <
    T extends { success: boolean; code?: string; analysisId?: string },
  >(
    stageFn: () => Promise<T>,
    errorPrefix: 'barcodeError' | 'ocrError'
  ) => {
    if (isStagingRef.current) return;
    isStagingRef.current = true;
    setIsStaging(true);
    try {
      const res = await stageFn();
      if (!res.success || !res.analysisId) {
        toast.error(t(`${errorPrefix}.${res.code || 'server_error'}`));
        return;
      }

      await confirmAndSaveMealAction({ analysisId: res.analysisId });
      toast.success(t('feedArea.savedMeal'));
      onSuccess();
      closeDialog();
    } catch {
      toast.error(t(`${errorPrefix}.server_error`));
    } finally {
      isStagingRef.current = false;
      setIsStaging(false);
    }
  };

  const handleStageMeal = async (grams: number) => {
    if (!product) return;
    await executeStageAndSave(
      () =>
        stageBarcodeMealAction({
          barcode: product.barcode,
          grams,
          loggedDate: selectedDate,
          timezoneOffset: new Date().getTimezoneOffset(),
        }),
      'barcodeError'
    );
  };

  const handleConfirmOcrMeal = async (
    payload: Parameters<
      React.ComponentProps<typeof OcrReviewStep>['onConfirm']
    >[0]
  ) => {
    await executeStageAndSave(
      () =>
        stageOcrMealAction({
          ...payload,
          loggedDate: selectedDate,
          timezoneOffset: new Date().getTimezoneOffset(),
        }),
      'ocrError'
    );
  };

  return {
    t,
    scanType,
    handleScanTypeChange,
    step,
    setStep,
    scanMode,
    setScanMode,
    barcode,
    setBarcode,
    searchError,
    setSearchError,
    isSearching,
    product,
    ocrData,
    setOcrData,
    isStaging,
    cameraStatus,
    cameras,
    selectedCameraId,
    effectiveCameraId,
    setSelectedCameraId,
    handleSearch,
    handleStageMeal,
    handleConfirmOcrMeal,
    handleClose,
  };
}

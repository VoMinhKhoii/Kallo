'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useBarcodeCameraScanner } from '@/hooks/meals/use-barcode-camera-scanner';
import {
  searchBarcodeAction,
  stageBarcodeMealAction,
} from '@/lib/actions/barcode';
import { confirmAndSaveMealAction } from '@/lib/actions/meals/confirm-and-save';
import { stageOcrMealAction } from '@/lib/actions/nutrition-ocr';
import { tryDecodeFontEncodedBarcode } from '@/lib/barcode/decode';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';
import type { ParsedNutritionLabel } from '@/lib/nutrition/ocr-schema';
import type { OcrReviewStep } from './ocr-review-step';

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

  const runSearch = useCallback(
    async (rawBarcode: string) => {
      const sanitized = tryDecodeFontEncodedBarcode(rawBarcode);
      setBarcode(sanitized);
      setIsSearching(true);
      setSearchError(null);

      try {
        const res = await searchBarcodeAction({ barcode: sanitized });
        if (res.success) {
          setProduct(res.data);
          setStep('quantity');
          return true;
        }
        setSearchError(t(`barcodeError.${res.code}`));
        return false;
      } catch {
        setSearchError(t('barcodeError.server_error'));
        return false;
      } finally {
        setIsSearching(false);
      }
    },
    [t]
  );

  const handleDecode = useCallback(
    (decodedText: string) => {
      runSearch(decodedText).then((success) => {
        if (!success) setScanMode('manual');
      });
    },
    [runSearch]
  );

  const handleCameraFailure = useCallback(() => {
    setScanMode('manual');
  }, []);

  const {
    cameraStatus,
    cameras,
    selectedCameraId,
    setSelectedCameraId,
    stopScanner,
  } = useBarcodeCameraScanner({
    isActive:
      isOpen &&
      step === 'input' &&
      scanType === 'barcode' &&
      scanMode === 'camera',
    onDecode: handleDecode,
    onCameraFailure: handleCameraFailure,
  });

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;
    await runSearch(trimmed);
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
    stopScanner();
    setTimeout(() => {
      setScanType('barcode');
      setStep('input');
      setScanMode('camera');
      setBarcode('');
      setSearchError(null);
      setProduct(null);
      setOcrData(null);
    }, 200);
  }, [onOpenChange, stopScanner]);

  const executeStageAndSave = async <
    T extends { success: boolean; code?: string; analysisId?: string },
  >(
    stageFn: () => Promise<T>,
    errorPrefix: 'barcodeError' | 'ocrError'
  ) => {
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
      handleClose();
    } catch {
      toast.error(t(`${errorPrefix}.server_error`));
    } finally {
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
    setScanType,
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
    setSelectedCameraId,
    handleSearch,
    handleStageMeal,
    handleConfirmOcrMeal,
    handleClose,
  };
}

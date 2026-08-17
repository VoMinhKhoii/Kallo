import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OcrReviewPayload } from '@/lib/nutrition/ocr-schema';

const mocks = vi.hoisted(() => ({
  confirmAndSaveMealAction: vi.fn(),
  searchBarcodeAction: vi.fn(),
  stageBarcodeMealAction: vi.fn(),
  stageOcrMealAction: vi.fn(),
  stopScanner: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/hooks/meals/use-barcode-camera-scanner', () => ({
  useBarcodeCameraScanner: () => ({
    cameraStatus: 'scanning',
    cameras: [],
    selectedCameraId: null,
    setSelectedCameraId: vi.fn(),
    stopScanner: mocks.stopScanner,
  }),
}));

vi.mock('@/lib/actions/logging/barcode', () => ({
  searchBarcodeAction: mocks.searchBarcodeAction,
  stageBarcodeMealAction: mocks.stageBarcodeMealAction,
}));

vi.mock('@/lib/actions/meals/confirm-and-save', () => ({
  confirmAndSaveMealAction: mocks.confirmAndSaveMealAction,
}));

vi.mock('@/lib/actions/logging/nutrition-ocr', () => ({
  stageOcrMealAction: mocks.stageOcrMealAction,
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import { useBarcodeScannerDialogState } from './use-barcode-scanner-dialog-state';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function reviewPayload(): OcrReviewPayload {
  return {
    productName: 'Sữa thử nghiệm',
    amount: 100,
    unit: 'ml',
    confidence: 'medium',
    calories: 80,
    proteinGrams: 3.5,
    carbsGrams: 10,
    fatGrams: 2,
    fiberGrams: null,
    sodiumMg: null,
    calciumMg: null,
    ironMg: null,
    magnesiumMg: null,
    phosphorusMg: null,
    potassiumMg: null,
    zincMg: null,
    copperMcg: null,
    manganeseMg: null,
    betaCaroteneMcg: null,
    vitaminAMcg: null,
    vitaminCMg: null,
    vitaminDMcg: null,
    vitaminEMg: null,
    vitaminKMcg: null,
    vitaminB1Mg: null,
    vitaminB2Mg: null,
    vitaminPpMg: null,
    vitaminB5Mg: null,
    vitaminB6Mg: null,
    vitaminB9Mcg: null,
    vitaminB12Mcg: null,
    vitaminHMcg: null,
  };
}

function renderDialogState() {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const hook = renderHook(() =>
    useBarcodeScannerDialogState({
      isOpen: true,
      onOpenChange,
      selectedDate: '2026-08-16',
      onSuccess,
    })
  );
  return { ...hook, onOpenChange, onSuccess };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirmAndSaveMealAction.mockResolvedValue({ success: true });
});

describe('useBarcodeScannerDialogState lifecycle', () => {
  it('stops the scanner and clears transient state on close', () => {
    const { result, onOpenChange } = renderDialogState();

    act(() => {
      result.current.setBarcode('8930000000000');
      result.current.setSearchError('old failure');
      result.current.handleClose();
    });

    expect(mocks.stopScanner).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(result.current.barcode).toBe('');
    expect(result.current.searchError).toBeNull();
  });

  it('ignores a barcode result after switching to OCR mode', async () => {
    const search = deferred<{
      success: true;
      data: { barcode: string; productName: string };
    }>();
    mocks.searchBarcodeAction.mockReturnValueOnce(search.promise);
    const { result } = renderDialogState();

    act(() => result.current.setBarcode('8930000000000'));
    let pendingSearch!: Promise<void>;
    act(() => {
      pendingSearch = result.current.handleSearch();
    });
    act(() => result.current.handleScanTypeChange('ocr'));
    await act(async () => {
      search.resolve({
        success: true,
        data: { barcode: '8930000000000', productName: 'Stale product' },
      });
      await pendingSearch;
    });

    expect(result.current.scanType).toBe('ocr');
    expect(result.current.step).toBe('input');
    expect(result.current.product).toBeNull();
    expect(result.current.isSearching).toBe(false);
  });

  it('blocks close while saving, then closes after save succeeds', async () => {
    const stage = deferred<{
      success: true;
      analysisId: string;
    }>();
    mocks.stageOcrMealAction.mockReturnValueOnce(stage.promise);
    const { result, onOpenChange, onSuccess } = renderDialogState();

    let pendingSave!: Promise<void>;
    act(() => {
      pendingSave = result.current.handleConfirmOcrMeal(reviewPayload());
    });
    expect(result.current.isStaging).toBe(true);

    act(() => result.current.handleClose());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(mocks.stopScanner).not.toHaveBeenCalled();

    await act(async () => {
      stage.resolve({ success: true, analysisId: 'analysis-123' });
      await pendingSave;
    });

    expect(mocks.confirmAndSaveMealAction).toHaveBeenCalledWith({
      analysisId: 'analysis-123',
    });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.stopScanner).toHaveBeenCalledOnce();
  });
});

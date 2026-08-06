'use client';

import { Barcode, FileText, Loader2, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { BarcodeProductStep } from './barcode-product-step';
import { OcrReviewStep } from './ocr-review-step';
import { OcrScannerTab } from './ocr-scanner-tab';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

const SCAN_TYPES = ['barcode', 'ocr'] as const;
const SCAN_MODES = ['camera', 'manual'] as const;

export function BarcodeScannerDialog({
  isOpen,
  onOpenChange,
  selectedDate,
  onSuccess,
}: BarcodeScannerDialogProps) {
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

  const handleStageMeal = async (grams: number) => {
    if (!product) return;
    setIsStaging(true);
    const timezoneOffset = new Date().getTimezoneOffset();

    try {
      const res = await stageBarcodeMealAction({
        barcode: product.barcode,
        grams,
        loggedDate: selectedDate,
        timezoneOffset,
      });

      if (!res.success) {
        toast.error(t(`barcodeError.${res.code}`));
        return;
      }

      await confirmAndSaveMealAction({ analysisId: res.analysisId });
      toast.success(t('feedArea.savedMeal'));
      onSuccess();
      handleClose();
    } catch {
      toast.error(t('barcodeError.server_error'));
    } finally {
      setIsStaging(false);
    }
  };

  const handleConfirmOcrMeal = async (
    payload: Parameters<
      React.ComponentProps<typeof OcrReviewStep>['onConfirm']
    >[0]
  ) => {
    setIsStaging(true);
    const timezoneOffset = new Date().getTimezoneOffset();

    try {
      const res = await stageOcrMealAction({
        ...payload,
        loggedDate: selectedDate,
        timezoneOffset,
      });

      if (!res.success) {
        toast.error(t(`ocrError.${res.code}`));
        return;
      }

      await confirmAndSaveMealAction({ analysisId: res.analysisId });
      toast.success(t('feedArea.savedMeal'));
      onSuccess();
      handleClose();
    } catch {
      toast.error(t('ocrError.server_error'));
    } finally {
      setIsStaging(false);
    }
  };

  const handleClose = () => {
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
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-[24px] border border-[#EAE7E0] bg-[#FDFCF8] p-0 font-sans-display text-nham-text sm:max-w-md"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-[#EAE7E0]/70 border-b px-6 py-4">
          <div className="min-w-0 space-y-1">
            <DialogTitle className="font-normal font-sans-display text-[22px] text-nham-text leading-tight tracking-tight">
              {scanType === 'barcode'
                ? t('barcodeDialogTitle')
                : t('ocrDialogTitle')}
            </DialogTitle>
            <DialogDescription className="font-sans-display text-[#8B8682] text-[13px] leading-normal">
              {scanType === 'barcode'
                ? t('barcodeDialogDesc')
                : t('ocrDialogDesc')}
            </DialogDescription>
          </div>
          <DialogClose
            aria-label={t('barcodeCancel')}
            className="-mr-1 shrink-0 rounded-full p-2 text-[#8B8682] transition-colors hover:bg-[#EAE7E0]/50 hover:text-nham-text"
          >
            <X className="h-5 w-5" />
          </DialogClose>
        </div>

        {step === 'input' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-[#EAE7E0]/70 border-b px-6 pt-3 pb-1">
              <div className="grid grid-cols-2 rounded-xl bg-nham-track p-1">
                {SCAN_TYPES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={scanType === st}
                    onClick={() => {
                      setScanType(st);
                      setSearchError(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium text-[13px] transition-all ${
                      scanType === st
                        ? 'bg-white text-nham-text shadow-sm'
                        : 'text-[#8B8682] hover:text-nham-text'
                    }`}
                  >
                    {st === 'barcode' ? (
                      <>
                        <Barcode className="h-3.5 w-3.5" />
                        {t('barcodeScan')}
                      </>
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5" />
                        {t('ocrTab')}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {scanType === 'ocr' ? (
              <OcrScannerTab
                onSuccess={(data) => {
                  setOcrData(data);
                  setStep('ocr-review');
                }}
              />
            ) : (
              <form
                onSubmit={handleSearch}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                  <div className="grid grid-cols-2 rounded-xl bg-nham-track/60 p-1">
                    {SCAN_MODES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={scanMode === m}
                        onClick={() => setScanMode(m)}
                        className={`rounded-lg px-3 py-1.5 font-medium font-sans-display text-[12px] transition-all ${
                          scanMode === m
                            ? 'bg-white text-nham-text shadow-sm'
                            : 'text-[#8B8682] hover:text-nham-text'
                        }`}
                      >
                        {m === 'camera'
                          ? t('barcodeScanTab')
                          : t('barcodeManualTab')}
                      </button>
                    ))}
                  </div>

                  {scanMode === 'camera' ? (
                    <div className="space-y-3">
                      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#EAE7E0] bg-black shadow-sm">
                        <div
                          id="nham-barcode-scanner"
                          className="[&_#qr-shaded-region]:!hidden h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 z-10">
                          <div className="absolute inset-0 bg-black/30" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative aspect-[2/1] w-2/3 max-w-[280px] rounded-lg border-2 border-nham-accent/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.4)]">
                              <div className="absolute -top-1 -left-1 h-4 w-4 rounded-tl border-nham-accent border-t-4 border-l-4" />
                              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-tr border-nham-accent border-t-4 border-r-4" />
                              <div className="absolute -bottom-1 -left-1 h-4 w-4 rounded-bl border-nham-accent border-b-4 border-l-4" />
                              <div className="absolute -right-1 -bottom-1 h-4 w-4 rounded-br border-nham-accent border-r-4 border-b-4" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-center font-sans-display text-[#8B8682] text-[12px]">
                        {cameraStatus === 'initializing' && (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{t('barcodeCameraInitializing')}</span>
                          </div>
                        )}
                        {cameraStatus === 'scanning' && (
                          <div className="space-y-2">
                            <span>{t('barcodeCameraScanning')}</span>
                            {cameras.length > 1 && (
                              <select
                                value={selectedCameraId || cameras[0]?.id}
                                onChange={(e) =>
                                  setSelectedCameraId(e.target.value)
                                }
                                className="mx-auto block rounded-lg border border-[#EAE7E0] bg-white px-2.5 py-1 text-xs"
                              >
                                {cameras.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.label ||
                                      `Camera ${d.id.substring(0, 5)}`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative flex items-center">
                        <Barcode className="absolute left-3 h-5 w-5 text-[#8B8682]/60" />
                        <Input
                          type="text"
                          placeholder={t('barcodePlaceholder')}
                          value={barcode}
                          onChange={(e) => {
                            setBarcode(e.target.value);
                            setSearchError(null);
                          }}
                          autoFocus
                          disabled={isSearching}
                          className="rounded-lg border-[#EAE7E0] bg-white pl-10 font-sans-display text-[14px] text-nham-text"
                        />
                      </div>
                      {searchError && (
                        <div className="space-y-2 rounded-lg bg-nham-danger/10 p-3 font-sans-display text-[13px] text-nham-danger">
                          <p>{searchError}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setScanType('ocr');
                              setSearchError(null);
                            }}
                            className="block font-medium text-[12px] text-nham-accent hover:underline"
                          >
                            {t('ocrFallbackPrompt')} &rarr;
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {scanMode === 'manual' && (
                  <div className="flex shrink-0 justify-end border-[#EAE7E0]/70 border-t bg-nham-track/50 px-6 py-4">
                    <button
                      type="submit"
                      disabled={isSearching || !barcode.trim()}
                      className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-nham-ink px-5 py-2.5 font-medium text-[#FDFCF8] text-[14px] shadow-sm disabled:opacity-50"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('barcodeSearching')}
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          {t('barcodeSearch')}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        ) : step === 'quantity' && product ? (
          <BarcodeProductStep
            key={product.barcode}
            product={product}
            isStaging={isStaging}
            onBack={() => setStep('input')}
            onConfirm={handleStageMeal}
          />
        ) : step === 'ocr-review' && ocrData ? (
          <OcrReviewStep
            data={ocrData}
            isStaging={isStaging}
            onBack={() => setStep('input')}
            onConfirm={handleConfirmOcrMeal}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

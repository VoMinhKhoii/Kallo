'use client';

import { Barcode, Loader2, Search, X } from 'lucide-react';
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
import { tryDecodeFontEncodedBarcode } from '@/lib/barcode/decode';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';
import { BarcodeProductStep } from './barcode-product-step';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

const SCAN_MODES = ['camera', 'manual'] as const;

export function BarcodeScannerDialog({
  isOpen,
  onOpenChange,
  selectedDate,
  onSuccess,
}: BarcodeScannerDialogProps) {
  const t = useTranslations('logging');
  const [step, setStep] = useState<'input' | 'quantity'>('input');
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [barcode, setBarcode] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [product, setProduct] = useState<ParsedBarcodeProduct | null>(null);

  // Quantity state (the resolved gram amount is owned by BarcodeProductStep).
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
        // A rejected server action (e.g. network/transport error) would
        // otherwise leave isSearching stuck true — surface a retryable error.
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
        if (!success) {
          setScanMode('manual');
        }
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
    isActive: isOpen && step === 'input' && scanMode === 'camera',
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

      // Confirm-and-save immediately so the barcode flow persists the meal in
      // one action — no separate pending-confirmation step in the feed. This is
      // the same server path the pending card's confirm button runs; the amount
      // was already chosen here, so no edits are passed.
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

  const handleClose = () => {
    onOpenChange(false);
    stopScanner();
    // Reset states after animation closes
    setTimeout(() => {
      setStep('input');
      setScanMode('camera');
      setBarcode('');
      setSearchError(null);
      setProduct(null);
    }, 200);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-[24px] border border-[#EAE7E0] bg-[#FDFCF8] p-0 font-sans-display text-nham-text sm:max-w-md"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-[#EAE7E0]/70 border-b px-6 py-4">
          <div className="min-w-0 space-y-1">
            <DialogTitle className="font-normal font-sans-display text-[22px] text-nham-text leading-tight tracking-tight">
              {t('barcodeDialogTitle')}
            </DialogTitle>
            <DialogDescription className="font-sans-display text-[#8B8682] text-[13px] leading-normal">
              {t('barcodeDialogDesc')}
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
          <form
            onSubmit={handleSearch}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {/* Scan-mode segmented control */}
              <div className="grid grid-cols-2 rounded-xl bg-nham-track p-1">
                {SCAN_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={scanMode === m}
                    onClick={() => setScanMode(m)}
                    className={`rounded-lg px-3 py-2 font-medium font-sans-display text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30 ${
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
                <div className="space-y-4">
                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#EAE7E0] bg-black shadow-sm">
                    {/* html5-qrcode video viewport container */}
                    <div
                      id="nham-barcode-scanner"
                      className="[&_#qr-shaded-region]:!hidden h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
                    />

                    {/* Overlay frame */}
                    <div className="pointer-events-none absolute inset-0 z-10">
                      <div className="absolute inset-0 bg-black/30" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative aspect-[2/1] w-2/3 max-w-[280px] rounded-lg border-2 border-nham-accent/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.4)]">
                          <div className="absolute -top-1 -left-1 h-4 w-4 rounded-tl border-nham-accent border-t-4 border-l-4" />
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-tr border-nham-accent border-t-4 border-r-4" />
                          <div className="absolute -bottom-1 -left-1 h-4 w-4 rounded-bl border-nham-accent border-b-4 border-l-4" />
                          <div className="absolute -right-1 -bottom-1 h-4 w-4 rounded-br border-nham-accent border-r-4 border-b-4" />
                          <div className="absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 animate-pulse bg-nham-accent opacity-80 shadow-[0_0_8px_rgba(224,116,62,0.8)]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="text-center font-sans-display text-[#8B8682] text-[13px]"
                    aria-live="polite"
                  >
                    {cameraStatus === 'initializing' ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-nham-text-muted" />
                        <span>{t('barcodeCameraInitializing')}</span>
                      </div>
                    ) : null}
                    {cameraStatus === 'scanning' ? (
                      <div className="space-y-3">
                        <span>{t('barcodeCameraScanning')}</span>
                        {cameras.length > 1 ? (
                          <div className="mx-auto flex w-full max-w-[280px] flex-col items-stretch gap-1.5">
                            <label
                              htmlFor="camera-select"
                              className="font-medium font-sans-display text-[#8B8682] text-[12px]"
                            >
                              {t('barcodeSelectCamera')}
                            </label>
                            <select
                              id="camera-select"
                              value={selectedCameraId || cameras[0]?.id}
                              onChange={(e) =>
                                setSelectedCameraId(e.target.value)
                              }
                              className="w-full rounded-lg border border-[#EAE7E0] bg-white px-3 py-2 font-sans-display text-nham-text text-sm shadow-sm transition-colors duration-200 focus:border-nham-accent focus:outline-none"
                            >
                              {cameras.map((device) => (
                                <option key={device.id} value={device.id}>
                                  {device.label ||
                                    `Camera ${device.id.substring(0, 5)}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {cameraStatus === 'permission-denied' ? (
                      <span
                        role="alert"
                        className="block rounded-lg bg-nham-danger/10 p-2 px-4 text-[13px] text-nham-danger leading-normal"
                      >
                        {t('barcodeCameraPermissionDenied')}
                      </span>
                    ) : null}
                    {cameraStatus === 'error' ? (
                      <span
                        role="alert"
                        className="block rounded-lg bg-nham-danger/10 p-2 px-4 text-[13px] text-nham-danger leading-normal"
                      >
                        {t('barcodeCameraError')}
                      </span>
                    ) : null}
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
                      aria-invalid={Boolean(searchError)}
                      className="rounded-lg border-[#EAE7E0] bg-white pl-10 font-sans-display text-[14px] text-nham-text focus-visible:border-nham-accent focus-visible:ring-1 focus-visible:ring-nham-accent/40"
                    />
                  </div>

                  {searchError ? (
                    <div
                      role="alert"
                      className="rounded-lg bg-nham-danger/10 p-3 font-sans-display text-[13px] text-nham-danger leading-snug"
                    >
                      {searchError}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Footer — only manual entry has a submit action; camera mode
                auto-detects, so its dismissal is the header close button. */}
            {scanMode === 'manual' ? (
              <div className="flex shrink-0 justify-end border-[#EAE7E0]/70 border-t bg-nham-track/50 px-6 py-4">
                <button
                  type="submit"
                  disabled={isSearching || !barcode.trim()}
                  aria-busy={isSearching}
                  className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-nham-ink px-5 py-2.5 font-medium font-sans-display text-[#FDFCF8] text-[14px] shadow-sm transition-colors hover:bg-[#1C1917] disabled:opacity-50"
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
            ) : null}
          </form>
        ) : product ? (
          <BarcodeProductStep
            key={product.barcode}
            product={product}
            isStaging={isStaging}
            onBack={() => setStep('input')}
            onConfirm={handleStageMeal}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

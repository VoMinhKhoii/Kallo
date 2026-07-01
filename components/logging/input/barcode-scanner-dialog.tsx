'use client';

import { Barcode, Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useBarcodeCameraScanner } from '@/hooks/meals/use-barcode-camera-scanner';
import {
  searchBarcodeAction,
  stageBarcodeMealAction,
} from '@/lib/actions/barcode';
import { tryDecodeFontEncodedBarcode } from '@/lib/barcode/decode';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';
import { BarcodeProductStep } from './barcode-product-step';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

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

  // Quantity states
  const [grams, setGrams] = useState<number>(100);
  const [isStaging, setIsStaging] = useState(false);

  const runSearch = useCallback(
    async (rawBarcode: string) => {
      const sanitized = tryDecodeFontEncodedBarcode(rawBarcode);
      setBarcode(sanitized);
      setIsSearching(true);
      setSearchError(null);

      const res = await searchBarcodeAction({ barcode: sanitized });
      setIsSearching(false);

      if (res.success) {
        setProduct(res.data);
        setStep('quantity');
      } else {
        setSearchError(t(`barcodeError.${res.code}`));
      }
      return res.success;
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

  const handleStageMeal = async () => {
    if (!product) return;

    setIsStaging(true);
    const timezoneOffset = new Date().getTimezoneOffset();

    const res = await stageBarcodeMealAction({
      barcode: product.barcode,
      grams,
      loggedDate: selectedDate,
      timezoneOffset,
    });

    setIsStaging(false);

    if (res.success) {
      toast.success(t('feedArea.savedMeal'));
      onSuccess();
      handleClose();
    } else {
      toast.error(t(`barcodeError.${res.code}`));
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
      setGrams(100);
    }, 200);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="border-nham-border bg-nham-surface text-nham-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-lora)] font-normal text-2xl text-nham-text">
            {t('barcodeDialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-nham-text-muted text-sm leading-normal">
            {t('barcodeDialogDesc')}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            {/* Tabs for scanning mode */}
            <div className="flex rounded-lg border border-nham-border/20 bg-nham-hover/30 p-1">
              <button
                type="button"
                onClick={() => setScanMode('camera')}
                className={`flex-1 cursor-pointer rounded-md py-1.5 font-medium text-xs transition-all duration-200 ${
                  scanMode === 'camera'
                    ? 'bg-nham-btn text-white shadow-sm'
                    : 'text-nham-text-muted hover:bg-nham-hover/50 hover:text-nham-text'
                }`}
              >
                {t('barcodeScanTab')}
              </button>
              <button
                type="button"
                onClick={() => setScanMode('manual')}
                className={`flex-1 cursor-pointer rounded-md py-1.5 font-medium text-xs transition-all duration-200 ${
                  scanMode === 'manual'
                    ? 'bg-nham-btn text-white shadow-sm'
                    : 'text-nham-text-muted hover:bg-nham-hover/50 hover:text-nham-text'
                }`}
              >
                {t('barcodeManualTab')}
              </button>
            </div>

            {scanMode === 'camera' ? (
              <div className="space-y-4">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-nham-border/40 bg-black shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                  {/* html5-qrcode video viewport container */}
                  <div
                    id="nham-barcode-scanner"
                    className="[&_#qr-shaded-region]:!hidden h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
                  />

                  {/* Premium overlay frame */}
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
                    <div className="absolute inset-0 bg-black/30" />

                    {/* Centered Cutout Frame */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative aspect-[2/1] w-2/3 max-w-[280px] rounded-lg border-2 border-nham-accent/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.4)]">
                        {/* Glow Corners */}
                        <div className="absolute -top-1 -left-1 h-4 w-4 rounded-tl border-nham-accent border-t-4 border-l-4" />
                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-tr border-nham-accent border-t-4 border-r-4" />
                        <div className="absolute -bottom-1 -left-1 h-4 w-4 rounded-bl border-nham-accent border-b-4 border-l-4" />
                        <div className="absolute -right-1 -bottom-1 h-4 w-4 rounded-br border-nham-accent border-r-4 border-b-4" />

                        {/* Scanning Laser Line */}
                        <div className="absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 animate-pulse bg-nham-accent opacity-80 shadow-[0_0_8px_rgba(224,116,62,0.8)]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="text-center text-nham-text-muted text-sm"
                  aria-live="polite"
                >
                  {cameraStatus === 'initializing' ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-nham-accent" />
                      <span>{t('barcodeCameraInitializing')}</span>
                    </div>
                  ) : null}
                  {cameraStatus === 'scanning' ? (
                    <div className="space-y-3">
                      <span>{t('barcodeCameraScanning')}</span>
                      {cameras.length > 1 ? (
                        <div className="mx-auto flex max-w-[280px] flex-col items-center gap-1.5 px-4">
                          <label
                            htmlFor="camera-select"
                            className="font-medium text-nham-text-muted text-xs"
                          >
                            {t('barcodeSelectCamera')}
                          </label>
                          <select
                            id="camera-select"
                            value={selectedCameraId || cameras[0]?.id}
                            onChange={(e) =>
                              setSelectedCameraId(e.target.value)
                            }
                            className="w-full rounded-lg border border-nham-border/40 bg-nham-cream px-3 py-1.5 text-nham-text text-sm shadow-sm transition-colors duration-200 focus:border-nham-accent focus:outline-none"
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
                      className="block rounded-lg bg-nham-danger/10 p-2 px-4 text-nham-danger text-xs leading-normal"
                    >
                      {t('barcodeCameraPermissionDenied')}
                    </span>
                  ) : null}
                  {cameraStatus === 'error' ? (
                    <span
                      role="alert"
                      className="block rounded-lg bg-nham-danger/10 p-2 px-4 text-nham-danger text-xs leading-normal"
                    >
                      {t('barcodeCameraError')}
                    </span>
                  ) : null}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClose}
                    className="text-nham-text-muted hover:bg-nham-hover hover:text-nham-text"
                  >
                    {t('barcodeCancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative flex items-center">
                    <Barcode className="absolute left-3 h-5 w-5 text-nham-text-muted/60" />
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
                      className="border-nham-border/60 bg-background pl-10 focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
                    />
                  </div>

                  {searchError ? (
                    <div
                      role="alert"
                      className="rounded-lg bg-nham-danger/10 p-3 text-nham-danger text-sm leading-snug"
                    >
                      {searchError}
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClose}
                    className="text-nham-text-muted hover:bg-nham-hover hover:text-nham-text"
                  >
                    {t('barcodeCancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSearching || !barcode.trim()}
                    aria-busy={isSearching}
                    className="bg-nham-btn text-white hover:bg-nham-btn-hover active:scale-95 disabled:opacity-50"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('barcodeSearching')}
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        {t('barcodeSearch')}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : product ? (
          <BarcodeProductStep
            product={product}
            grams={grams}
            onGramsChange={setGrams}
            isStaging={isStaging}
            onBack={() => setStep('input')}
            onConfirm={handleStageMeal}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

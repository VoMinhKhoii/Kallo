'use client';

import {
  Barcode,
  ChevronLeft,
  Loader2,
  Minus,
  Plus,
  Search,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  searchBarcodeAction,
  stageBarcodeMealAction,
} from '@/lib/actions/barcode';
import { tryDecodeFontEncodedBarcode } from '@/lib/barcode/decode';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';

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
  const [cameraStatus, setCameraStatus] = useState<
    'initializing' | 'scanning' | 'permission-denied' | 'error'
  >('initializing');
  const [barcode, setBarcode] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [product, setProduct] = useState<ParsedBarcodeProduct | null>(null);

  // Camera selection states
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  // Scanner instance ref
  const qrCodeScannerRef = useRef<any>(null);

  // Quantity states
  const [grams, setGrams] = useState<number>(100);
  const [isStaging, setIsStaging] = useState(false);

  const stopScanner = useCallback(async () => {
    if (qrCodeScannerRef.current) {
      try {
        if (qrCodeScannerRef.current.isScanning) {
          await qrCodeScannerRef.current.stop();
        }
      } catch (err) {
        console.error('Error stopping scanner:', err);
      } finally {
        qrCodeScannerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen && step === 'input' && scanMode === 'camera') {
      let isMounted = true;
      setCameraStatus('initializing');
      let scannerInstance: any = null;

      const playBeep = () => {
        try {
          const ctx = new (
            window.AudioContext || (window as any).webkitAudioContext
          )();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          osc.start();
          setTimeout(() => {
            try {
              osc.stop();
              ctx.close();
            } catch {}
          }, 120);
        } catch (e) {
          console.warn('Audio beep failed', e);
        }
      };

      const startScanner = async () => {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          if (!isMounted) return;

          // Query available cameras
          let devices: { id: string; label: string }[] = [];
          try {
            devices = await Html5Qrcode.getCameras();
            if (isMounted) {
              setCameras(devices);
            }
          } catch (e) {
            console.warn('Failed to get cameras:', e);
          }

          // Wait slightly for DOM element to render
          await new Promise((resolve) => setTimeout(resolve, 150));
          if (!isMounted) return;

          const scanner = new Html5Qrcode('nham-barcode-scanner');
          qrCodeScannerRef.current = scanner;
          scannerInstance = scanner;

          // Select camera config:
          // 1. User selected camera ID
          // 2. First camera from queried list
          // 3. Fallback standard facingMode environment configuration
          const cameraConfig =
            selectedCameraId ||
            (devices.length > 0 ? devices[0].id : { facingMode: 'environment' });

          await scanner.start(
            cameraConfig,
            {
              fps: 10,
              qrbox: (width, height) => {
                // Ensure qrbox dimensions are always at least 50px to prevent library errors
                const w = Math.max(50, Math.round(width * 0.75));
                const h = Math.max(50, Math.round(height * 0.4));
                return { width: w, height: h };
              },
              aspectRatio: 1.777778,
            },
            (decodedText) => {
              playBeep();
              if (navigator.vibrate) {
                try {
                  navigator.vibrate(80);
                } catch {}
              }

              stopScanner().then(() => {
                if (!isMounted) return;
                const sanitized = tryDecodeFontEncodedBarcode(decodedText);
                setBarcode(sanitized);
                setIsSearching(true);
                setSearchError(null);

                searchBarcodeAction({ barcode: sanitized }).then((res) => {
                  if (!isMounted) return;
                  setIsSearching(false);
                  if (res.success) {
                    setProduct(res.data);
                    setStep('quantity');
                  } else {
                    setSearchError(res.error);
                    setScanMode('manual');
                  }
                });
              });
            },
            () => {
              // Ignore verbose scanning errors
            }
          );

          if (isMounted) {
            setCameraStatus('scanning');
          }
        } catch (err: any) {
          console.error('Failed to start scanner:', err);
          if (isMounted) {
            const errStr = String(err).toLowerCase();
            if (
              errStr.includes('permission') ||
              errStr.includes('notallowed')
            ) {
              setCameraStatus('permission-denied');
            } else {
              setCameraStatus('error');
            }
            // Auto switch to manual mode after 3 seconds on failure
            setTimeout(() => {
              if (isMounted) {
                setScanMode('manual');
              }
            }, 3000);
          }
        }
      };

      startScanner();

      return () => {
        isMounted = false;
        if (scannerInstance) {
          try {
            if (scannerInstance.isScanning) {
              scannerInstance.stop().catch(console.error);
            }
          } catch {}
        }
      };
    }
  }, [isOpen, step, scanMode, stopScanner, selectedCameraId]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = barcode.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setSearchError(null);

    const sanitized = tryDecodeFontEncodedBarcode(trimmed);
    setBarcode(sanitized);

    const res = await searchBarcodeAction({ barcode: sanitized });
    setIsSearching(false);

    if (res.success) {
      setProduct(res.data);
      setStep('quantity');
    } else {
      setSearchError(res.error);
    }
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
      toast.error(res.error);
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

  const adjustGrams = (amount: number) => {
    setGrams((prev) => Math.max(1, prev + amount));
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
                    className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover [&_#qr-shaded-region]:!hidden"
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

                <div className="text-center text-nham-text-muted text-sm">
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
                          <label htmlFor="camera-select" className="text-xs text-nham-text-muted font-medium">
                            {t('barcodeSelectCamera')}
                          </label>
                          <select
                            id="camera-select"
                            value={selectedCameraId || cameras[0]?.id}
                            onChange={(e) => setSelectedCameraId(e.target.value)}
                            className="w-full rounded-lg border border-nham-border/40 bg-nham-cream px-3 py-1.5 text-sm text-nham-text shadow-sm focus:border-nham-accent focus:outline-none transition-colors duration-200"
                          >
                            {cameras.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.label || `Camera ${device.id.substring(0, 5)}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {cameraStatus === 'permission-denied' ? (
                    <span className="block rounded-lg bg-nham-danger/10 p-2 px-4 text-nham-danger text-xs leading-normal">
                      {t('barcodeCameraPermissionDenied')}
                    </span>
                  ) : null}
                  {cameraStatus === 'error' ? (
                    <span className="block rounded-lg bg-nham-danger/10 p-2 px-4 text-nham-danger text-xs leading-normal">
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
                    {t('feedArea.partialYesterdayPrompt.dismiss')}
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
                      className="border-nham-border/60 bg-background pl-10 focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
                    />
                  </div>

                  {searchError ? (
                    <div className="rounded-lg bg-nham-danger/10 p-3 text-nham-danger text-sm leading-snug">
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
                    {t('feedArea.partialYesterdayPrompt.dismiss')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSearching || !barcode.trim()}
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
          <div className="space-y-6">
            {/* Product Header */}
            <div className="border-nham-border/40 border-b pb-3">
              {product.brand ? (
                <span className="font-[var(--font-dm-sans)] text-nham-text-muted text-xs uppercase tracking-wider">
                  {product.brand}
                </span>
              ) : null}
              <h3 className="font-[var(--font-lora)] font-normal text-nham-text text-xl">
                {product.name}
              </h3>
            </div>

            {/* Nutrition Profile per 100g */}
            <div className="space-y-2">
              <span className="text-nham-text-muted text-xs">
                Dinh dưỡng trên 100g:
              </span>
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                  <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                    Calo
                  </span>
                  <span className="font-[var(--font-lora)] font-normal text-base text-nham-text">
                    {product.caloriesKcal !== null
                      ? Math.round(product.caloriesKcal)
                      : '--'}
                  </span>
                  <span className="block text-[9px] text-nham-text-muted">
                    kcal
                  </span>
                </div>

                <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                  <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                    Đạm
                  </span>
                  <span className="font-[var(--font-lora)] font-normal text-base text-nham-text">
                    {product.proteinG !== null ? product.proteinG : '--'}
                  </span>
                  <span className="block text-[9px] text-nham-text-muted">
                    g
                  </span>
                </div>

                <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                  <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                    Carb
                  </span>
                  <span className="font-[var(--font-lora)] font-normal text-base text-nham-text">
                    {product.carbohydrateG !== null
                      ? product.carbohydrateG
                      : '--'}
                  </span>
                  <span className="block text-[9px] text-nham-text-muted">
                    g
                  </span>
                </div>

                <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                  <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                    Béo
                  </span>
                  <span className="font-[var(--font-lora)] font-normal text-base text-nham-text">
                    {product.fatG !== null ? product.fatG : '--'}
                  </span>
                  <span className="block text-[9px] text-nham-text-muted">
                    g
                  </span>
                </div>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-2">
              <label
                htmlFor="grams-input"
                className="font-medium text-nham-text-muted text-sm"
              >
                {t('barcodeGramsLabel')}
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => adjustGrams(-50)}
                  disabled={grams <= 50}
                  className="border-nham-border/60 hover:bg-nham-hover"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                <Input
                  id="grams-input"
                  type="number"
                  min="1"
                  max="10000"
                  value={grams}
                  onChange={(e) =>
                    setGrams(
                      Math.max(1, Number.parseInt(e.target.value, 10) || 0)
                    )
                  }
                  className="border-nham-border/60 bg-background text-center font-medium focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => adjustGrams(50)}
                  className="border-nham-border/60 hover:bg-nham-hover"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick select chips */}
              <div className="flex gap-2 pt-1">
                {[50, 100, 150, 200, 250].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setGrams(val)}
                    className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                      grams === val
                        ? 'border-nham-accent/60 bg-nham-cheat-fill text-nham-text'
                        : 'border-nham-border/30 bg-background text-nham-text-muted hover:bg-nham-hover'
                    }`}
                  >
                    {val}g
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('input')}
                className="text-nham-text-muted hover:bg-nham-hover hover:text-nham-text"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('barcodeBack')}
              </Button>
              <Button
                type="button"
                onClick={handleStageMeal}
                disabled={isStaging || grams <= 0}
                className="bg-nham-btn text-white hover:bg-nham-btn-hover active:scale-95 disabled:opacity-50"
              >
                {isStaging ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('analyzing')}
                  </>
                ) : (
                  t('barcodeAddMeal')
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

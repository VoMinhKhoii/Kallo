'use client';

import { Barcode, FileText, Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BarcodeCameraView } from './barcode-camera-view';
import { BarcodeDialogHeader } from './barcode-dialog-header';
import { BarcodeManualInput } from './barcode-manual-input';
import { BarcodeProductStep } from './barcode-product-step';
import { OcrReviewStep } from './ocr-review-step';
import { OcrScannerTab } from './ocr-scanner-tab';
import { useBarcodeScannerDialogState } from './use-barcode-scanner-dialog-state';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

const SCAN_TYPES = ['barcode', 'ocr'] as const;
const SCAN_MODES = ['camera', 'manual'] as const;

export function BarcodeScannerDialog(props: BarcodeScannerDialogProps) {
  const {
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
  } = useBarcodeScannerDialogState(props);

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-[24px] border border-[#EAE7E0] bg-[#FDFCF8] p-0 font-sans-display text-nham-text sm:max-w-md"
      >
        <BarcodeDialogHeader
          scanType={scanType}
          title={
            scanType === 'barcode'
              ? t('barcodeDialogTitle')
              : t('ocrDialogTitle')
          }
          description={
            scanType === 'barcode' ? t('barcodeDialogDesc') : t('ocrDialogDesc')
          }
          cancelText={t('barcodeCancel')}
        />

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
                    <BarcodeCameraView
                      cameraStatus={cameraStatus}
                      cameras={cameras}
                      selectedCameraId={selectedCameraId}
                      onCameraChange={setSelectedCameraId}
                      initializingText={t('barcodeCameraInitializing')}
                      scanningText={t('barcodeCameraScanning')}
                    />
                  ) : (
                    <BarcodeManualInput
                      barcode={barcode}
                      onBarcodeChange={(val) => {
                        setBarcode(val);
                        setSearchError(null);
                      }}
                      isSearching={isSearching}
                      searchError={searchError}
                      placeholderText={t('barcodePlaceholder')}
                      fallbackPromptText={t('ocrFallbackPrompt')}
                      onFallbackClick={() => {
                        setScanType('ocr');
                        setSearchError(null);
                      }}
                    />
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

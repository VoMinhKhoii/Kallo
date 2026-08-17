'use client';

import { Barcode, FileText } from 'lucide-react';
import { BarcodeDialogHeader } from '@/components/logging/input/barcode/barcode-dialog-header';
import { BarcodeProductStep } from '@/components/logging/input/barcode/barcode-product-step';
import { BarcodeSearchForm } from '@/components/logging/input/barcode/barcode-search-form';
import { useBarcodeScannerDialogState } from '@/components/logging/input/barcode/use-barcode-scanner-dialog-state';
import { OcrReviewStep } from '@/components/logging/input/ocr/review/ocr-review-step';
import { OcrScannerTab } from '@/components/logging/input/ocr/scan/ocr-scanner-tab';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

const SCAN_TYPES = ['barcode', 'ocr'] as const;

export function BarcodeScannerDialog(props: BarcodeScannerDialogProps) {
  const {
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
    effectiveCameraId,
    setSelectedCameraId,
    handleSearch,
    handleStageMeal,
    handleConfirmOcrMeal,
    handleClose,
  } = useBarcodeScannerDialogState(props);

  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={(open) => !open && !isStaging && handleClose()}
    >
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (isStaging) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (isStaging) event.preventDefault();
        }}
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-[24px] border border-[#EAE7E0] bg-[#FDFCF8] p-0 font-sans-display text-kallo-text sm:max-w-md"
      >
        <BarcodeDialogHeader
          title={
            step === 'ocr-review'
              ? t('ocrReviewTitle')
              : scanType === 'barcode'
                ? t('barcodeDialogTitle')
                : t('ocrDialogTitle')
          }
          description={
            step === 'ocr-review'
              ? t('ocrReviewDesc')
              : scanType === 'barcode'
                ? t('barcodeDialogDesc')
                : t('ocrDialogDesc')
          }
          cancelText={t('barcodeCancel')}
          isCloseDisabled={isStaging}
        />

        {step === 'input' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-[#EAE7E0]/70 border-b px-6 pt-3 pb-1">
              <div className="grid grid-cols-2 rounded-xl bg-kallo-track p-1">
                {SCAN_TYPES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={scanType === st}
                    onClick={() => {
                      handleScanTypeChange(st);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium text-[13px] transition-all ${
                      scanType === st
                        ? 'bg-white text-kallo-text shadow-sm'
                        : 'text-[#8B8682] hover:text-kallo-text'
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
                onManualEntry={() => {
                  setOcrData(null);
                  setStep('ocr-review');
                }}
              />
            ) : (
              <BarcodeSearchForm
                scanMode={scanMode}
                onScanModeChange={setScanMode}
                barcode={barcode}
                onBarcodeChange={(val) => {
                  setBarcode(val);
                  setSearchError(null);
                }}
                isSearching={isSearching}
                searchError={searchError}
                cameraStatus={cameraStatus}
                cameras={cameras}
                selectedCameraId={effectiveCameraId}
                onCameraChange={setSelectedCameraId}
                onFallbackToOcr={() => {
                  handleScanTypeChange('ocr');
                }}
                onSearch={handleSearch}
              />
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
        ) : step === 'ocr-review' ? (
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

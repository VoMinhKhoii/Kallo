'use client';

import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import { BarcodeProductStep } from '@/components/logging/input/barcode/barcode-product-step';
import { BarcodeSearchForm } from '@/components/logging/input/barcode/barcode-search-form';
import { ScanTypeToggle } from '@/components/logging/input/barcode/scan-type-toggle';
import { useBarcodeScannerDialogState } from '@/components/logging/input/barcode/use-barcode-scanner-dialog-state';
import { OcrReviewStep } from '@/components/logging/input/ocr/review/ocr-review-step';
import { OcrScannerTab } from '@/components/logging/input/ocr/scan/ocr-scanner-tab';
import { ResponsiveSheet } from '@/components/shared/responsive-sheet';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

export function BarcodeScannerDialog(props: BarcodeScannerDialogProps) {
  const { locked, openPaywall } = usePremiumGuard();
  const ocrLocked = locked('label_scan');
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

  // The sheet owns the viewport on mobile, so the paywall has to replace it
  // rather than stack on top of it — close first, then open the dialog.
  const handleSelectScanType = (next: 'barcode' | 'ocr') => {
    if (next === 'ocr' && ocrLocked) {
      handleClose();
      openPaywall();
      return;
    }
    handleScanTypeChange(next);
  };

  const title =
    step === 'ocr-review'
      ? t('ocrReviewTitle')
      : scanType === 'barcode'
        ? t('barcodeDialogTitle')
        : t('ocrDialogTitle');

  return (
    <ResponsiveSheet
      open={props.isOpen}
      onOpenChange={(open) => !open && handleClose()}
      // A save in flight must not be dismissable: the request would still
      // complete server-side, silently logging a meal the user never saw
      // confirmed. Same lock the Flutter sheet applies.
      dismissible={!isStaging}
      title={title}
    >
      <ResponsiveSheetHeader
        title={title}
        closeLabel={t('barcodeCancel')}
        closeDisabled={isStaging}
        onClose={handleClose}
      />

      {step === 'input' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-kallo-border/70 border-b px-4 pt-3 pb-1 sm:px-6">
            <ScanTypeToggle
              scanType={scanType}
              ocrLocked={ocrLocked}
              onSelect={handleSelectScanType}
            />
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
                handleSelectScanType('ocr');
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
    </ResponsiveSheet>
  );
}

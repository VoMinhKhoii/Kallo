'use client';

import { Loader2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BarcodeCameraView } from '@/components/logging/input/barcode/barcode-camera-view';
import { BarcodeManualInput } from '@/components/logging/input/barcode/barcode-manual-input';
import type { CameraStatus } from '@/hooks/ui/use-barcode-camera-scanner';

const SCAN_MODES = ['camera', 'manual'] as const;

interface BarcodeSearchFormProps {
  /** Camera scanning vs typing the digits — the two ways to reach a lookup. */
  scanMode: 'camera' | 'manual';
  onScanModeChange: (mode: 'camera' | 'manual') => void;
  barcode: string;
  onBarcodeChange: (value: string) => void;
  isSearching: boolean;
  searchError: string | null;
  cameraStatus: CameraStatus;
  cameras: Array<{ id: string; label?: string }>;
  selectedCameraId: string | null;
  onCameraChange: (id: string) => void;
  /** The product had no barcode match worth typing — offer label OCR instead. */
  onFallbackToOcr: () => void;
  onSearch: (event: React.FormEvent) => void;
}

/** The barcode tab of the scanner dialog: scan with the camera or type the
 *  digits, then look the product up. */
export function BarcodeSearchForm({
  scanMode,
  onScanModeChange,
  barcode,
  onBarcodeChange,
  isSearching,
  searchError,
  cameraStatus,
  cameras,
  selectedCameraId,
  onCameraChange,
  onFallbackToOcr,
  onSearch,
}: BarcodeSearchFormProps) {
  const t = useTranslations('logging');

  return (
    <form onSubmit={onSearch} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
        <div className="grid grid-cols-2 rounded-xl bg-kallo-track/60 p-1">
          {SCAN_MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={scanMode === m}
              onClick={() => onScanModeChange(m)}
              className={`rounded-lg px-3 py-1.5 font-medium font-sans-display text-[12px] transition-all ${
                scanMode === m
                  ? 'bg-white text-kallo-text shadow-sm'
                  : 'text-[#8B8682] hover:text-kallo-text'
              }`}
            >
              {m === 'camera' ? t('barcodeScanTab') : t('barcodeManualTab')}
            </button>
          ))}
        </div>

        {scanMode === 'camera' ? (
          <BarcodeCameraView
            cameraStatus={cameraStatus}
            cameras={cameras}
            selectedCameraId={selectedCameraId}
            onCameraChange={onCameraChange}
            initializingText={t('barcodeCameraInitializing')}
            scanningText={t('barcodeCameraScanning')}
            permissionDeniedText={t('barcodeCameraPermissionDenied')}
            cameraErrorText={t('barcodeCameraError')}
            fallbackText={t('barcodeManualFallback')}
            selectCameraLabel={t('barcodeSelectCamera')}
            cameraFallbackLabel={t('barcodeCameraFallbackLabel')}
            onFallback={() => onScanModeChange('manual')}
          />
        ) : (
          <BarcodeManualInput
            barcode={barcode}
            onBarcodeChange={onBarcodeChange}
            isSearching={isSearching}
            searchError={searchError}
            placeholderText={t('barcodePlaceholder')}
            fallbackPromptText={t('ocrFallbackPrompt')}
            onFallbackClick={onFallbackToOcr}
          />
        )}
      </div>

      {scanMode === 'manual' && (
        <div className="flex shrink-0 justify-end border-[#EAE7E0]/70 border-t bg-kallo-track/50 px-6 py-4">
          <button
            type="submit"
            disabled={isSearching || !barcode.trim()}
            className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-kallo-ink px-5 py-2.5 font-medium text-[#FDFCF8] text-[14px] shadow-sm disabled:opacity-50"
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
  );
}

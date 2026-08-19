'use client';

import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useOcrCamera } from '@/hooks/meals/use-ocr-camera';
import { useOcrImageSelection } from '@/hooks/meals/use-ocr-image-selection';
import type { ParsedNutritionLabel } from '@/lib/nutrition/ocr-schema';
import { OcrCameraView } from './ocr-camera-view';
import { OcrFailureActions } from './ocr-failure-actions';
import { OcrImagePreview } from './ocr-image-preview';
import { OcrModeToggle } from './ocr-mode-toggle';
import { OcrUploadPanel } from './ocr-upload-panel';

/**
 * Whether the scanner offers "enter nutrition manually" as an escape hatch.
 * Off for now — typing 28 nutrients off a package is a worse job than the
 * manual log mode already does with a food search, and offering it beside the
 * camera invited it before the scan had been tried.
 *
 * Mirrors `isManualNutritionEntryOffered` in the Flutter app
 * (`features/logging/logic/meal_log_mode.dart`). Flip both together.
 */
const IS_MANUAL_NUTRITION_ENTRY_OFFERED = false;

export function OcrScannerTab({
  onSuccess,
  onManualEntry,
}: {
  onSuccess: (data: ParsedNutritionLabel) => void;
  onManualEntry: () => void;
}) {
  const t = useTranslations('logging');
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const image = useOcrImageSelection(onSuccess);
  const camera = useOcrCamera(mode === 'camera' && !image.hasImage);

  const handleCapturePhoto = async () => {
    const file = await camera.capturePhoto();
    if (file) image.selectImage(file);
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <input
        type="file"
        ref={image.fileInputRef}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={image.handleFileSelect}
        className="hidden"
      />

      {!image.hasImage && (
        <OcrModeToggle
          mode={mode}
          setMode={setMode}
          stopCamera={camera.stopCamera}
          scanTabLabel={t('barcodeScanTab')}
          uploadTabLabel={t('ocrUploadTab')}
        />
      )}

      {image.previewUrl ? (
        <OcrImagePreview
          src={image.previewUrl}
          alt={t('ocrPreviewAlt')}
          editText={t('edit')}
          isProcessing={image.isProcessing}
          onClear={image.clearImage}
        />
      ) : mode === 'camera' ? (
        <OcrCameraView
          videoRef={camera.videoRef}
          isCameraActive={camera.isCameraActive}
          cameraError={camera.cameraError}
          cameras={camera.cameras}
          selectedCameraId={camera.selectedCameraId}
          capabilities={camera.capabilities}
          torchEnabled={camera.torchEnabled}
          focusMode={camera.focusMode}
          resolution={camera.resolution}
          text={{
            snap: t('ocrSnapPhoto'),
            guide: t('ocrCaptureGuide'),
            upload: t('ocrCameraFallback'),
            permissionDenied: t('ocrCameraPermissionDenied'),
            unavailable: t('ocrCameraUnavailable'),
            camera: t('ocrCameraLabel'),
            cameraFallback: t('ocrCameraFallbackLabel'),
            torch: t('ocrTorchLabel'),
            focus: t('ocrFocusLabel'),
            resolution: t('ocrResolutionLabel'),
            focusLabels: {
              continuous: t('ocrFocusContinuous'),
              'single-shot': t('ocrFocusSingle'),
              manual: t('ocrFocusManual'),
            },
          }}
          onCapture={handleCapturePhoto}
          onUploadClick={() => image.fileInputRef.current?.click()}
          onCameraChange={camera.setSelectedCameraId}
          onTorchChange={camera.setTorch}
          onFocusChange={camera.setFocusMode}
          onResolutionChange={camera.setResolution}
        />
      ) : (
        <OcrUploadPanel
          hint={t('ocrUploadHint')}
          formats={t('ocrFormatHint')}
          onChoose={() => image.fileInputRef.current?.click()}
        />
      )}

      {image.error && (
        <OcrFailureActions
          message={t(`ocrError.${image.error}`)}
          retryText={t('ocrRetryPhoto')}
          manualText={t('ocrManualEntry')}
          isProcessing={image.isProcessing}
          onRetry={image.scan}
          onManualEntry={
            IS_MANUAL_NUTRITION_ENTRY_OFFERED ? onManualEntry : undefined
          }
        />
      )}

      {image.selectedFile && !image.error && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={image.scan}
            disabled={image.isProcessing}
            aria-busy={image.isProcessing}
            className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-nham-ink px-5 py-2.5 font-medium font-sans-display text-[14px] text-nham-surface shadow-sm transition-colors hover:bg-[#1C1917] disabled:opacity-50"
          >
            {image.isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {image.isCompressing ? t('ocrCompressing') : t('ocrScanning')}
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                {t('submit')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

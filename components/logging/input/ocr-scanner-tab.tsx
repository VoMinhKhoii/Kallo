'use client';

import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useNutritionOcr } from '@/hooks/meals/use-nutrition-ocr';
import { useOcrCamera } from '@/hooks/meals/use-ocr-camera';
import type { ParsedNutritionLabel } from '@/lib/nutrition/ocr-schema';
import { OcrCameraView } from './ocr-camera-view';
import { OcrFailureActions } from './ocr-failure-actions';
import { OcrImagePreview } from './ocr-image-preview';
import { OcrModeToggle } from './ocr-mode-toggle';
import { OcrUploadPanel } from './ocr-upload-panel';

export function OcrScannerTab({
  onSuccess,
  onManualEntry,
}: {
  onSuccess: (data: ParsedNutritionLabel) => void;
  onManualEntry: () => void;
}) {
  const t = useTranslations('logging');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const scanGenerationRef = useRef(0);
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const camera = useOcrCamera(mode === 'camera' && !previewUrl);
  const { scanLabel, isCompressing, isScanning, error, resetError } =
    useNutritionOcr();

  useEffect(
    () => () => {
      scanGenerationRef.current += 1;
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const selectImage = (file: File) => {
    scanGenerationRef.current += 1;
    resetError();
    setSelectedFile(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
  };

  const handleCapturePhoto = async () => {
    const file = await camera.capturePhoto();
    if (file) selectImage(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectImage(file);
  };

  const handleClearImage = () => {
    scanGenerationRef.current += 1;
    setSelectedFile(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    resetError();
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    const scanGeneration = ++scanGenerationRef.current;
    try {
      const result = await scanLabel(selectedFile);
      if (scanGeneration === scanGenerationRef.current) onSuccess(result);
    } catch (error) {
      console.warn('Nutrition label scan failed:', error);
    }
  };

  const isProcessing = isCompressing || isScanning;

  const safePreviewUrl =
    previewUrl &&
    (previewUrl.startsWith('blob:') || previewUrl.startsWith('data:image/'))
      ? previewUrl
      : undefined;

  return (
    <div className="space-y-4 p-6">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!previewUrl && (
        <OcrModeToggle
          mode={mode}
          setMode={setMode}
          stopCamera={camera.stopCamera}
          scanTabLabel={t('barcodeScanTab')}
          uploadTabLabel={t('ocrUploadTab')}
        />
      )}

      {safePreviewUrl ? (
        <OcrImagePreview
          src={safePreviewUrl}
          alt={t('ocrPreviewAlt')}
          editText={t('edit')}
          isProcessing={isProcessing}
          onClear={handleClearImage}
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
          onUploadClick={() => fileInputRef.current?.click()}
          onCameraChange={camera.setSelectedCameraId}
          onTorchChange={camera.setTorch}
          onFocusChange={camera.setFocusMode}
          onResolutionChange={camera.setResolution}
        />
      ) : (
        <OcrUploadPanel
          hint={t('ocrUploadHint')}
          formats={t('ocrFormatHint')}
          onChoose={() => fileInputRef.current?.click()}
        />
      )}

      {error && (
        <OcrFailureActions
          message={t(`ocrError.${error}`)}
          retryText={t('ocrRetryPhoto')}
          manualText={t('ocrManualEntry')}
          isProcessing={isProcessing}
          onRetry={handleScan}
          onManualEntry={onManualEntry}
        />
      )}

      {selectedFile && !error && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleScan}
            disabled={isProcessing}
            aria-busy={isProcessing}
            className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-nham-ink px-5 py-2.5 font-medium font-sans-display text-[#FDFCF8] text-[14px] shadow-sm transition-colors hover:bg-[#1C1917] disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCompressing ? t('ocrCompressing') : t('ocrScanning')}
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

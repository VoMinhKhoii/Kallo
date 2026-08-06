'use client';

import {
  Camera,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useNutritionOcr } from '@/hooks/meals/use-nutrition-ocr';
import { useOcrCamera } from '@/hooks/meals/use-ocr-camera';
import type { ParsedNutritionLabel } from '@/lib/nutrition/ocr-schema';
import { OcrCameraView } from './ocr-camera-view';

export function OcrScannerTab({
  onSuccess,
}: {
  onSuccess: (data: ParsedNutritionLabel) => void;
}) {
  const t = useTranslations('logging');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'camera' | 'upload'>('camera');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { videoRef, isCameraActive, cameraError, capturePhoto, stopCamera } =
    useOcrCamera(mode === 'camera' && !previewUrl);
  const { scanLabel, isCompressing, isScanning, error, resetError } =
    useNutritionOcr();

  const handleCapturePhoto = async () => {
    const file = await capturePhoto();
    if (!file) return;
    resetError();
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetError();
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    resetError();
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    try {
      const result = await scanLabel(selectedFile);
      if (result) onSuccess(result);
    } catch {}
  };

  const isProcessing = isCompressing || isScanning;

  return (
    <div className="space-y-4 p-6">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!previewUrl && (
        <div className="grid grid-cols-2 rounded-xl bg-nham-track/60 p-1">
          <button
            type="button"
            aria-pressed={mode === 'camera'}
            onClick={() => setMode('camera')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium font-sans-display text-[12px] transition-all ${
              mode === 'camera'
                ? 'bg-white text-nham-text shadow-sm'
                : 'text-[#8B8682] hover:text-nham-text'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            {t('barcodeScanTab')}
          </button>
          <button
            type="button"
            aria-pressed={mode === 'upload'}
            onClick={() => {
              setMode('upload');
              stopCamera();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium font-sans-display text-[12px] transition-all ${
              mode === 'upload'
                ? 'bg-white text-nham-text shadow-sm'
                : 'text-[#8B8682] hover:text-nham-text'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            {t('ocrUploadTab')}
          </button>
        </div>
      )}

      {previewUrl ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#EAE7E0] bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* biome-ignore lint/performance/noImgElement: Blob preview URL */}
          <img
            src={previewUrl}
            alt="Nutrition label preview"
            className="h-full w-full object-contain"
          />
          {!isProcessing && (
            <button
              type="button"
              onClick={handleClearImage}
              className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 font-medium text-[12px] text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            >
              <RefreshCw className="h-3 w-3" />
              {t('edit')}
            </button>
          )}
        </div>
      ) : mode === 'camera' ? (
        <OcrCameraView
          videoRef={videoRef}
          isCameraActive={isCameraActive}
          cameraError={cameraError}
          onCapture={handleCapturePhoto}
          onUploadClick={() => fileInputRef.current?.click()}
          uploadHintText={t('ocrUploadHint')}
        />
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ')
              fileInputRef.current?.click();
          }}
          tabIndex={0}
          role="button"
          className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-[#EAE7E0] border-dashed bg-nham-track/20 p-6 text-center transition-colors hover:border-nham-accent/50 hover:bg-nham-track/40"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-nham-accent shadow-sm">
            <Upload className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium font-sans-display text-[14px] text-nham-text">
              {t('ocrUploadHint')}
            </p>
            <p className="font-sans-display text-[#8B8682] text-[12px]">
              PNG, JPG or WebP
            </p>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-nham-danger/10 p-3 font-sans-display text-[13px] text-nham-danger leading-snug"
        >
          {error}
        </div>
      )}

      {selectedFile && (
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

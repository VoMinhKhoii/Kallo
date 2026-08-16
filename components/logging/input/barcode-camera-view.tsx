'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { CameraStatus } from '@/hooks/meals/use-barcode-camera-scanner';

interface BarcodeCameraViewProps {
  cameraStatus: CameraStatus;
  cameras: Array<{ id: string; label?: string }>;
  selectedCameraId: string | null;
  onCameraChange: (id: string) => void;
  initializingText: string;
  scanningText: string;
  permissionDeniedText: string;
  cameraErrorText: string;
  fallbackText: string;
  selectCameraLabel: string;
  cameraFallbackLabel: string;
  onFallback: () => void;
}

export function BarcodeCameraView({
  cameraStatus,
  cameras,
  selectedCameraId,
  onCameraChange,
  initializingText,
  scanningText,
  permissionDeniedText,
  cameraErrorText,
  fallbackText,
  selectCameraLabel,
  cameraFallbackLabel,
  onFallback,
}: BarcodeCameraViewProps) {
  const hasError =
    cameraStatus === 'permission-denied' || cameraStatus === 'error';
  const previousStatusRef = useRef<CameraStatus | null>(null);

  useEffect(() => {
    if (hasError && previousStatusRef.current !== cameraStatus) {
      toast.error(
        cameraStatus === 'permission-denied'
          ? permissionDeniedText
          : cameraErrorText
      );
    }
    previousStatusRef.current = cameraStatus;
  }, [cameraErrorText, cameraStatus, hasError, permissionDeniedText]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#EAE7E0] bg-black shadow-sm sm:aspect-video">
        <div
          id="nham-barcode-scanner"
          className="[&_#qr-shaded-region]:hidden! h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
        />
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-[1.8/1] w-[88%] max-w-[340px] rounded-xl border-2 border-nham-accent/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]">
              <div className="absolute -top-1 -left-1 h-4 w-4 rounded-tl border-nham-accent border-t-4 border-l-4" />
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-tr border-nham-accent border-t-4 border-r-4" />
              <div className="absolute -bottom-1 -left-1 h-4 w-4 rounded-bl border-nham-accent border-b-4 border-l-4" />
              <div className="absolute -right-1 -bottom-1 h-4 w-4 rounded-br border-nham-accent border-r-4 border-b-4" />
            </div>
          </div>
        </div>
      </div>
      <div className="text-center font-sans-display text-[#8B8682] text-[12px]">
        {hasError && (
          <div
            role="alert"
            className="space-y-2 rounded-xl bg-nham-danger/10 p-3 text-nham-danger"
          >
            <p>
              {cameraStatus === 'permission-denied'
                ? permissionDeniedText
                : cameraErrorText}
            </p>
            <button
              type="button"
              onClick={onFallback}
              className="rounded-lg bg-nham-ink px-3 py-1.5 font-medium text-white text-xs"
            >
              {fallbackText}
            </button>
          </div>
        )}
        {cameraStatus === 'initializing' && (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{initializingText}</span>
          </div>
        )}
        {cameraStatus === 'scanning' && (
          <div className="space-y-2">
            <span>{scanningText}</span>
            {cameras.length > 1 && (
              <select
                aria-label={selectCameraLabel}
                value={selectedCameraId ?? ''}
                onChange={(e) => onCameraChange(e.target.value)}
                className="mx-auto block rounded-lg border border-[#EAE7E0] bg-white px-2.5 py-1 text-xs"
              >
                {cameras.map((d, index) => (
                  <option key={d.id} value={d.id}>
                    {d.label || `${cameraFallbackLabel} ${index + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

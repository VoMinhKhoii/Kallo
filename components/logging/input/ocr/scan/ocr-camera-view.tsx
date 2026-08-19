'use client';

import { Camera } from 'lucide-react';
import type { RefObject } from 'react';
import { OcrCameraControls } from '@/components/logging/input/ocr/scan/ocr-camera-controls';
import type {
  OcrCameraCapabilities,
  OcrCameraDevice,
  OcrCameraError,
  OcrCameraResolution,
} from '@/lib/domain/nutrition/ocr/camera-types';

interface OcrCameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  cameraError: OcrCameraError | null;
  cameras: OcrCameraDevice[];
  selectedCameraId: string | null;
  capabilities: OcrCameraCapabilities;
  torchEnabled: boolean;
  focusMode: string | null;
  resolution: OcrCameraResolution | null;
  text: {
    snap: string;
    guide: string;
    upload: string;
    permissionDenied: string;
    unavailable: string;
    camera: string;
    cameraFallback: string;
    torch: string;
    focus: string;
    resolution: string;
    focusLabels: Record<string, string>;
  };
  onCapture: () => void;
  onUploadClick: () => void;
  onCameraChange: (id: string) => void;
  onTorchChange: (enabled: boolean) => void;
  onFocusChange: (mode: string) => void;
  onResolutionChange: (resolution: OcrCameraResolution) => void;
}

export function OcrCameraView(props: OcrCameraViewProps) {
  if (props.cameraError) {
    return (
      <div
        role="alert"
        className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[#EAE7E0] bg-black p-6 text-center text-white sm:aspect-video"
      >
        <Camera className="h-8 w-8 text-white/50" />
        <p className="text-white/80 text-xs">
          {props.cameraError === 'permission_denied'
            ? props.text.permissionDenied
            : props.text.unavailable}
        </p>
        <button
          type="button"
          onClick={props.onUploadClick}
          className="mt-2 rounded-lg bg-white/20 px-3 py-1.5 text-white text-xs hover:bg-white/30"
        >
          {props.text.upload}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-[#8B8682] text-xs">{props.text.guide}</p>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#EAE7E0] bg-black shadow-sm sm:aspect-video">
        <video
          ref={props.videoRef}
          autoPlay
          playsInline
          muted
          aria-label={props.text.camera}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 m-3 rounded-xl border-2 border-kallo-accent/70 border-dashed sm:m-6" />
        {props.isCameraActive && (
          <>
            <div className="absolute top-2 right-2 left-2">
              <OcrCameraControls
                cameras={props.cameras}
                selectedCameraId={props.selectedCameraId}
                capabilities={props.capabilities}
                torchEnabled={props.torchEnabled}
                focusMode={props.focusMode}
                resolution={props.resolution}
                cameraLabel={props.text.camera}
                cameraFallbackLabel={props.text.cameraFallback}
                torchLabel={props.text.torch}
                focusLabel={props.text.focus}
                resolutionLabel={props.text.resolution}
                focusLabels={props.text.focusLabels}
                onCameraChange={props.onCameraChange}
                onTorchChange={props.onTorchChange}
                onFocusChange={props.onFocusChange}
                onResolutionChange={props.onResolutionChange}
              />
            </div>
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <button
                type="button"
                onClick={props.onCapture}
                className="flex items-center gap-2 rounded-full bg-kallo-accent px-4 py-2 font-medium text-white text-xs shadow-lg active:scale-95"
              >
                <Camera className="h-4 w-4" />
                {props.text.snap}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

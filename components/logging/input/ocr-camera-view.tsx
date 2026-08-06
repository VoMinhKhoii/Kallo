'use client';

import { Camera } from 'lucide-react';
import type { RefObject } from 'react';

interface OcrCameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  cameraError: string | null;
  onCapture: () => void;
  onUploadClick: () => void;
  uploadHintText: string;
}

export function OcrCameraView({
  videoRef,
  isCameraActive,
  cameraError,
  onCapture,
  onUploadClick,
  uploadHintText,
}: OcrCameraViewProps) {
  if (cameraError) {
    return (
      <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#EAE7E0] bg-black p-6 text-center text-white shadow-sm">
        <Camera className="h-8 w-8 text-white/50" />
        <p className="text-white/80 text-xs">{cameraError}</p>
        <button
          type="button"
          onClick={onUploadClick}
          className="mt-2 rounded-lg bg-white/20 px-3 py-1.5 text-white text-xs hover:bg-white/30"
        >
          {uploadHintText}
        </button>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#EAE7E0] bg-black shadow-sm">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 m-6 flex items-center justify-center rounded-xl border-2 border-nham-accent/50 border-dashed" />
      {isCameraActive && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={onCapture}
            className="flex items-center gap-2 rounded-full bg-nham-accent px-4 py-2 font-medium text-white text-xs shadow-lg transition-transform active:scale-95"
          >
            <Camera className="h-4 w-4" />
            Snap Photo
          </button>
        </div>
      )}
    </div>
  );
}

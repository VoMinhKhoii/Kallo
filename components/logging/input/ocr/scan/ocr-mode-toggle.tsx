'use client';

import { Camera, Upload } from 'lucide-react';

interface OcrModeToggleProps {
  mode: 'camera' | 'upload';
  setMode: (mode: 'camera' | 'upload') => void;
  stopCamera: () => void;
  scanTabLabel: string;
  uploadTabLabel: string;
}

export function OcrModeToggle({
  mode,
  setMode,
  stopCamera,
  scanTabLabel,
  uploadTabLabel,
}: OcrModeToggleProps) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-kallo-track/60 p-1">
      <button
        type="button"
        aria-pressed={mode === 'camera'}
        onClick={() => setMode('camera')}
        className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium font-sans-display text-[12px] transition-all ${
          mode === 'camera'
            ? 'bg-white text-kallo-text shadow-sm'
            : 'text-kallo-text-muted hover:text-kallo-text'
        }`}
      >
        <Camera className="h-3.5 w-3.5" />
        {scanTabLabel}
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
            ? 'bg-white text-kallo-text shadow-sm'
            : 'text-kallo-text-muted hover:text-kallo-text'
        }`}
      >
        <Upload className="h-3.5 w-3.5" />
        {uploadTabLabel}
      </button>
    </div>
  );
}

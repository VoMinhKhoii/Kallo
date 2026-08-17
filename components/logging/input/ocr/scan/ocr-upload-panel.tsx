'use client';

import { Upload } from 'lucide-react';

interface OcrUploadPanelProps {
  hint: string;
  formats: string;
  onChoose: () => void;
}

export function OcrUploadPanel(props: OcrUploadPanelProps) {
  return (
    <div
      onClick={props.onChoose}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') props.onChoose();
      }}
      tabIndex={0}
      role="button"
      className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-[#EAE7E0] border-dashed bg-kallo-track/20 p-6 text-center transition-colors hover:border-kallo-accent/50 hover:bg-kallo-track/40"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-kallo-accent shadow-sm">
        <Upload className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-[14px] text-kallo-text">{props.hint}</p>
        <p className="text-[#8B8682] text-[12px]">{props.formats}</p>
      </div>
    </div>
  );
}

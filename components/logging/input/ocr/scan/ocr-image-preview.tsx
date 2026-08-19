'use client';

import { RefreshCw } from 'lucide-react';
import Image from 'next/image';

interface OcrImagePreviewProps {
  src: string;
  alt: string;
  editText: string;
  isProcessing: boolean;
  onClear: () => void;
}

export function OcrImagePreview(props: OcrImagePreviewProps) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-kallo-border bg-black/5">
      <Image
        src={props.src}
        alt={props.alt}
        fill
        unoptimized
        className="object-contain"
      />
      {!props.isProcessing && (
        <button
          type="button"
          onClick={props.onClear}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 font-medium text-[12px] text-white backdrop-blur-sm hover:bg-black/80"
        >
          <RefreshCw className="h-3 w-3" />
          {props.editText}
        </button>
      )}
    </div>
  );
}

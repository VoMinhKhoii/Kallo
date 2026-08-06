'use client';

import { X } from 'lucide-react';
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

interface BarcodeDialogHeaderProps {
  scanType: 'barcode' | 'ocr';
  title: string;
  description: string;
  cancelText: string;
}

export function BarcodeDialogHeader({
  title,
  description,
  cancelText,
}: BarcodeDialogHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-[#EAE7E0]/70 border-b px-6 py-4">
      <div className="min-w-0 space-y-1">
        <DialogTitle className="font-normal font-sans-display text-[22px] text-nham-text leading-tight tracking-tight">
          {title}
        </DialogTitle>
        <DialogDescription className="font-sans-display text-[#8B8682] text-[13px] leading-normal">
          {description}
        </DialogDescription>
      </div>
      <DialogClose
        aria-label={cancelText}
        className="-mr-1 shrink-0 rounded-full p-2 text-[#8B8682] transition-colors hover:bg-[#EAE7E0]/50 hover:text-nham-text"
      >
        <X className="h-5 w-5" />
      </DialogClose>
    </div>
  );
}

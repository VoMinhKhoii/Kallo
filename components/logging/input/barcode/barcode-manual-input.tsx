'use client';

import { Barcode } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface BarcodeManualInputProps {
  barcode: string;
  onBarcodeChange: (val: string) => void;
  isSearching: boolean;
  searchError: string | null;
  placeholderText: string;
  fallbackPromptText: string;
  onFallbackClick: () => void;
}

export function BarcodeManualInput({
  barcode,
  onBarcodeChange,
  isSearching,
  searchError,
  placeholderText,
  fallbackPromptText,
  onFallbackClick,
}: BarcodeManualInputProps) {
  return (
    <div className="space-y-2">
      <div className="relative flex items-center">
        <Barcode className="absolute left-3 h-5 w-5 text-[#8B8682]/60" />
        <Input
          type="text"
          placeholder={placeholderText}
          value={barcode}
          onChange={(e) => onBarcodeChange(e.target.value)}
          autoFocus
          disabled={isSearching}
          className="rounded-lg border-[#EAE7E0] bg-white pl-10 font-sans-display text-[14px] text-kallo-text"
        />
      </div>
      {searchError && (
        <div
          role="alert"
          className="space-y-2 rounded-lg bg-kallo-danger/10 p-3 font-sans-display text-[13px] text-kallo-danger"
        >
          <p>{searchError}</p>
          <button
            type="button"
            onClick={onFallbackClick}
            className="block font-medium text-[12px] text-kallo-accent hover:underline"
          >
            {fallbackPromptText} &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { Barcode, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';

export type ScanType = 'barcode' | 'ocr';

const SCAN_TYPES: ScanType[] = ['barcode', 'ocr'];

interface ScanTypeToggleProps {
  scanType: ScanType;
  /** True when label scanning is Premium-locked for this user. */
  ocrLocked: boolean;
  onSelect: (next: ScanType) => void;
}

/** The barcode / label-scan segmented control above the scanner body. */
export function ScanTypeToggle({
  scanType,
  ocrLocked,
  onSelect,
}: ScanTypeToggleProps) {
  const t = useTranslations('logging');

  return (
    <div className="grid grid-cols-2 rounded-xl bg-kallo-track p-1">
      {SCAN_TYPES.map((st) => (
        <button
          key={st}
          type="button"
          aria-pressed={scanType === st}
          onClick={() => onSelect(st)}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-medium text-[12px] transition-all ${
            scanType === st
              ? 'bg-white text-kallo-text shadow-sm'
              : 'text-kallo-text-muted hover:text-kallo-text'
          }`}
        >
          {st === 'barcode' ? (
            <>
              <Barcode className="h-3.5 w-3.5" />
              {t('barcodeScan')}
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5" />
              {t('ocrTab')}
              {ocrLocked && <PremiumChip className="px-1.5 py-0" />}
            </>
          )}
        </button>
      ))}
    </div>
  );
}

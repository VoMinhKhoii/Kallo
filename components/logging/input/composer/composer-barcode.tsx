'use client';

import { Barcode } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ScanDialog } from '@/components/logging/input/scan/dialog';

/** The composer's barcode button and the scan dialog it opens. */
export function ComposerBarcode({
  selectedDate,
  disabled,
  onSuccess,
}: {
  selectedDate: string;
  disabled?: boolean;
  onSuccess: () => void;
}) {
  const t = useTranslations('logging');
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-kallo-border/40 text-kallo-text-muted transition-all duration-200 hover:bg-kallo-hover hover:text-kallo-text active:scale-95 disabled:opacity-30"
        aria-label={t('barcodeScan')}
      >
        <Barcode className="h-4 w-4" />
      </button>
      <ScanDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        selectedDate={selectedDate}
        onSuccess={onSuccess}
      />
    </>
  );
}

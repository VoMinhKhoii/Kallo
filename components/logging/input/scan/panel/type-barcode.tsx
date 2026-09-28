'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { ScanPanel } from './panel';

/** The digits of the longest retail code (GTIN-14); EAN-8 is the shortest. */
export const MAX_BARCODE_DIGITS = 14;
export const MIN_BARCODE_DIGITS = 8;

/** Digits only, at most 14, grouped in fours so a long code reads against the
 *  pack at a glance ("8938 5078 4913 1"). */
export function groupBarcodeDigits(typed: string): string {
  const digits = typed.replace(/\D/g, '').slice(0, MAX_BARCODE_DIGITS);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * "Type barcode" — the Flutter app's `TypeBarcodePanel`: a short sheet over
 * the camera, the digits large enough to check against the pack, one
 * full-width Look up that waits for a whole code.
 */
export function TypeBarcodePanel({
  onBack,
  onLookUp,
}: {
  onBack: () => void;
  onLookUp: (digits: string) => void;
}) {
  const t = useTranslations('logging.scan');
  const [value, setValue] = useState('');
  const digits = value.replace(/\D/g, '');
  const ready = digits.length >= MIN_BARCODE_DIGITS;
  const submit = () => {
    if (ready) onLookUp(digits);
  };

  return (
    <ScanPanel
      level="fit"
      label={t('typeBarcode')}
      header={
        <ResponsiveSheetHeader
          title={t('typeBarcode')}
          closeLabel={t('back')}
          backLabel={t('back')}
          onClose={onBack}
          onBack={onBack}
        />
      }
    >
      <form
        className="flex flex-col gap-5 px-4 pt-5 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: the keypad is why this panel opened.
          autoFocus
          aria-label={t('typeBarcode')}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={t('digitsPlaceholder')}
          onChange={(event) => setValue(groupBarcodeDigits(event.target.value))}
          className="w-full bg-transparent text-center font-semibold text-[32px] text-kallo-text tabular-nums tracking-wide outline-none placeholder:text-kallo-border"
        />
        <button
          type="submit"
          disabled={!ready}
          className="flex h-[52px] items-center justify-center rounded-full bg-kallo-hover font-semibold text-[16px] text-kallo-text transition-colors hover:bg-kallo-border disabled:opacity-50"
        >
          {t('lookUp')}
        </button>
      </form>
    </ScanPanel>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';
import { cn } from '@/lib/core/ui/cn';
import type { ScanMode } from '../scan-view';
import { SCAN_GLASS } from './scan-glass-button';

/**
 * The camera's mode switch: dark glass like the buttons around it, the chosen
 * mode on a lighter pill — the Flutter app's `ScanModeChip`. Words, not
 * icons: "Barcode" and "Nutrition label" are what the user is pointing at.
 *
 * Nutrition label is Premium: while locked, the Premium chip sits just past
 * the switch, beside that segment, and a click opens the paywall (the
 * dialog's `switchMode` holds the gate).
 */
export function ScanModeSwitch({
  mode,
  locked,
  onChange,
}: {
  mode: ScanMode;
  locked: boolean;
  onChange: (mode: ScanMode) => void;
}) {
  const t = useTranslations('logging.scan');
  const modes: ScanMode[] = ['barcode', 'label'];
  const labels = { barcode: t('modeBarcode'), label: t('modeLabel') };
  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        className={cn('grid grid-cols-2 rounded-full p-[3px]', SCAN_GLASS)}
      >
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onChange(m)}
            className={cn(
              'h-9 rounded-full px-4 text-[16px] transition-colors',
              mode === m
                ? 'bg-white/[0.22] text-white'
                : 'text-white/70 hover:text-white'
            )}
          >
            {labels[m]}
          </button>
        ))}
      </div>
      {locked && <PremiumChip />}
    </div>
  );
}

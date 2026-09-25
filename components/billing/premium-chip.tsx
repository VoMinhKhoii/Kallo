'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/core/ui/cn';

/**
 * The "Premium" pill worn by a locked entry point: a soft blue label, 18px
 * tall, the same four values as the Flutter chip (`--kallo-premium-*` in
 * `app/globals.css`).
 *
 * On an option row it sits at the far right end, vertically centred on the
 * label — the row lays that out, not the chip. Icon-only buttons wear
 * `PremiumDot` instead. Callers render it only when `locked(feature)` says so;
 * the locked option itself stays full ink.
 */
export function PremiumChip({ className }: { className?: string }) {
  const t = useTranslations('billing');
  return (
    <span
      className={cn(
        'inline-flex h-[18px] shrink-0 items-center rounded-full border border-kallo-premium-edge bg-kallo-premium-fill px-[7px] font-sans-display font-semibold text-[11px] text-kallo-premium-ink leading-none',
        className
      )}
    >
      {t('premium.chip')}
    </span>
  );
}

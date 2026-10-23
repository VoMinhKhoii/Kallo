'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { forwardRef } from 'react';
import { portionDisplay } from '@/components/logging/feed/meal-entry/portion/portion-display';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';

interface PortionAssumptionLineProps
  extends React.ComponentPropsWithoutRef<'button'> {
  vessel: ClientVessel;
  /** The item's current grams — decides whether a tier label is honest. */
  grams: number;
}

/**
 * A quiet one-line portion assumption under a meal item — a small vessel
 * thumbnail and '≈ {tier label}', kept visually subordinate to the macros.
 * The whole line is a button: on an unsaved card it opens the meal edit
 * dialog (it forwards ref + props).
 */
export const PortionAssumptionLine = forwardRef<
  HTMLButtonElement,
  PortionAssumptionLineProps
>(({ vessel, grams, ...props }, ref) => {
  const t = useTranslations('logging.portionPicker');
  const locale = useLocale();
  const loc = locale === 'vi' ? 'vi' : 'en';

  const { thumb, label } = portionDisplay(vessel, grams, loc);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={t('adjust', { label })}
      className="-mt-1 flex min-h-[40px] items-center gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-kallo-hover/40"
      {...props}
    >
      <span className="flex shrink-0 items-end">
        <Image
          src={`/portions/${thumb.file}`}
          alt=""
          width={Math.round(20 * thumb.aspect)}
          height={20}
          className="h-5 w-auto opacity-80"
        />
      </span>
      <span className="text-[12px] text-kallo-text-muted">
        {t('assumption', { label })}
      </span>
    </button>
  );
});

PortionAssumptionLine.displayName = 'PortionAssumptionLine';

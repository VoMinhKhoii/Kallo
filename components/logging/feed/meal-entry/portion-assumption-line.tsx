'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { forwardRef } from 'react';
import { VESSEL_FAMILIES } from '@/lib/ai/portion/vessel-data';
import type { MealItem } from '@/lib/types/meal';

type ContainerVessel = NonNullable<MealItem['vessel']> & {
  family: 'bowl' | 'plate' | 'cup';
};

interface PortionAssumptionLineProps
  extends React.ComponentPropsWithoutRef<'button'> {
  vessel: ContainerVessel;
}

/**
 * A quiet one-line portion assumption under a meal item — a small vessel
 * thumbnail and '≈ {tier label}', kept visually subordinate to the macros.
 * The whole line is the button that opens the portion picker (used as the
 * picker's trigger via `asChild`, so it forwards ref + props).
 */
export const PortionAssumptionLine = forwardRef<
  HTMLButtonElement,
  PortionAssumptionLineProps
>(({ vessel, ...props }, ref) => {
  const t = useTranslations('logging.portionPicker');
  const locale = useLocale();
  const tier = VESSEL_FAMILIES[vessel.family].tiers[vessel.tier];
  const label = locale === 'vi' ? tier.label.vi : tier.label.en;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={t('adjust', { label })}
      className="-mt-1 flex min-h-[40px] items-center gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-nham-hover/40"
      {...props}
    >
      <Image
        src={`/portions/${tier.asset}`}
        alt=""
        width={20}
        height={20}
        className="shrink-0 opacity-80"
      />
      <span className="text-[12px] text-nham-text-muted">
        {t('assumption', { label })}
      </span>
    </button>
  );
});

PortionAssumptionLine.displayName = 'PortionAssumptionLine';

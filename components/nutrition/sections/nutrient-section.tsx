'use client';

import { usePremiumGuard } from '@/components/billing/premium-guard-provider';
import type { NutrientCardData } from '@/lib/domain/nutrition/types';
import { MicronutrientsLockedCard } from './micronutrients-locked-card';
import { NutrientGrid } from './nutrient-grid';

interface NutrientSectionProps {
  micronutrients: NutrientCardData[];
  moreNutrients: NutrientCardData[];
  /**
   * The SERVER's verdict (`overview.micronutrientsLocked`) — the data is
   * already stripped by the time it gets here, so this must not be re-derived
   * from client entitlements.
   */
  locked: boolean;
}

/** The micronutrient slot of the nutrition page: the grid, or its paywall. */
export function NutrientSection({
  micronutrients,
  moreNutrients,
  locked,
}: NutrientSectionProps) {
  const { openPaywall } = usePremiumGuard();

  if (locked) {
    return <MicronutrientsLockedCard onUpgrade={openPaywall} />;
  }

  return (
    <NutrientGrid
      micronutrients={micronutrients}
      moreNutrients={moreNutrients}
    />
  );
}

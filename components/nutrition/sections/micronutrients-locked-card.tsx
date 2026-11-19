'use client';

import { useTranslations } from 'next-intl';
import { SurfaceState } from '@/components/shared/surface-state/surface-state';
import { Button } from '@/components/ui/button';
import { NUTRITION_CAST } from '@/lib/brand/illustrations/casts/nutrition';

/**
 * What stands in for the nutrient grid when micronutrients are Premium-locked:
 * the shared surface state with the sloth-telescope pose (`nutrition` /
 * `locked`). Presentational only — the server decides the lock; the CTA is the
 * caller's, and goes to /pricing.
 */
export function MicronutrientsLockedCard({
  onUpgrade,
}: {
  onUpgrade: () => void;
}) {
  const t = useTranslations('billing.premium.micronutrientsLock');

  return (
    <SurfaceState
      cast={NUTRITION_CAST}
      kind="locked"
      title={t('title')}
      subtitle={t('subtitle')}
      action={
        <Button onClick={onUpgrade} size="sm" type="button" variant="ink">
          {t('cta')}
        </Button>
      }
    />
  );
}

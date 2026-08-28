'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PremiumChip } from '@/components/billing/premium-chip';
import { Button } from '@/components/ui/button';

/**
 * What stands in for the nutrient grid when micronutrients are Premium-locked.
 * Presentational only — the server decides the lock; the CTA is the caller's.
 */
export function MicronutrientsLockedCard({
  onUpgrade,
}: {
  onUpgrade: () => void;
}) {
  const t = useTranslations('billing');

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-kallo-border/60 bg-card p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-kallo-text-muted" />
        <h2 className="min-w-0 flex-1 font-medium text-[13px] text-kallo-text">
          {t('premium.micronutrientsLock.title')}
        </h2>
        <PremiumChip />
      </div>
      <p className="text-[12px] text-kallo-text-muted leading-relaxed">
        {t('premium.micronutrientsLock.body')}
      </p>
      <div className="flex">
        <Button onClick={onUpgrade} size="sm" type="button">
          {t('premium.micronutrientsLock.cta')}
        </Button>
      </div>
    </section>
  );
}

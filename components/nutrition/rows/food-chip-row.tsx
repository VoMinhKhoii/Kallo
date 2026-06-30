'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { getFoodSourceCandidates } from '@/lib/nutrition/actions';
import type { NutritionNutrientKey } from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';

interface FoodChipRowProps {
  nutrient: NutritionNutrientKey;
  enabled?: boolean;
  /** Adjusts visual treatment between spotlight (warmer) and steady contexts. */
  variant?: 'spotlight' | 'steady';
  /** Maximum chips to render. */
  limit?: number;
}

export function FoodChipRow({
  nutrient,
  enabled = true,
  variant = 'spotlight',
  limit = 5,
}: FoodChipRowProps) {
  const t = useTranslations('nutrition');
  const locale = useLocale();

  const query = useQuery({
    queryKey: ['nutrition', 'candidates', nutrient],
    queryFn: () => getFoodSourceCandidates({ nutrient }),
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return <ChipRowSkeleton variant={variant} />;
  }

  // Distinguish a fetch failure (logged for ops + visible "couldn't load"
  // message) from a successful response with zero foods ("no ideas").
  // Both stay visually quiet so they don't overwhelm the editorial layout.
  if (query.isError) {
    console.error(
      '[nutrition] candidates query failed for nutrient',
      nutrient,
      query.error
    );
    return (
      <p className="text-nham-text-muted text-xs">
        {t('errors.candidatesError')}
      </p>
    );
  }

  if (query.isSuccess && !query.data.foods.length) {
    return (
      <p className="text-nham-text-muted text-xs">{t('focus.noFoodIdeas')}</p>
    );
  }

  if (!query.data?.foods.length) {
    return null;
  }

  const chips = query.data.foods.slice(0, limit);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-bold text-[10px] text-nham-stone uppercase tracking-[0.2em]">
        {t('focus.tryLabel')}
      </span>
      {chips.map((food) => (
        <span
          key={food.id}
          className={cn(
            'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] leading-5',
            variant === 'spotlight'
              ? 'border-nham-accent/40 bg-nham-accent/10 text-nham-text'
              : 'border-nham-border/60 bg-nham-surface text-nham-text-muted'
          )}
        >
          {locale === 'vi' ? food.name : food.nameEn}
        </span>
      ))}
    </div>
  );
}

function ChipRowSkeleton({ variant }: { variant: 'spotlight' | 'steady' }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
      {[60, 80, 70, 90].map((width) => (
        <span
          key={width}
          className={cn(
            'inline-block h-7 rounded-full',
            variant === 'spotlight' ? 'bg-nham-accent/15' : 'bg-nham-track'
          )}
          style={{ width }}
        />
      ))}
    </div>
  );
}

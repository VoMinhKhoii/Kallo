'use client';

import { useTranslations } from 'next-intl';
import type { EducationCardData } from '@/lib/nutrition/types';

interface VitaminDCardProps {
  card: EducationCardData;
}

export function VitaminDCard({ card }: VitaminDCardProps) {
  const t = useTranslations();

  return (
    <article className="rounded-3xl border border-nham-border/60 bg-card p-5 shadow-[0_4px_24px_rgba(44,36,22,0.04)]">
      <p className="font-bold text-[10px] text-nham-stone uppercase tracking-[0.16em]">
        {t('nutrition.education.label')}
      </p>
      <h3 className="mt-2 font-semibold text-lg text-nham-text">
        {t(card.titleKey)}
      </h3>
      <p className="mt-2 max-w-3xl text-nham-text-muted text-sm leading-6">
        {t(card.bodyKey)}
      </p>
    </article>
  );
}

'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type {
  NutritionData,
  StatsData,
  VerdictData,
} from '@/components/dashboard/types';
import type { WeightSummaryData } from '@/lib/types/weight';
import { DeficitCard, PaceCard } from './pace-deficit-card';
import { WeightCard } from './weight-streak-card';

interface CurrentSectionProps {
  verdict: VerdictData;
  stats: StatsData;
  nutrition: NutritionData;
  weightSummary: WeightSummaryData | undefined;
}

export function CurrentSection({
  verdict,
  stats,
  nutrition,
  weightSummary,
}: CurrentSectionProps) {
  const t = useTranslations('dashboard');
  const remaining = Math.max(
    0,
    nutrition.calories.target - nutrition.calories.current
  );

  return (
    <div className="flex items-stretch gap-5">
      {/* Kcal Left — dominant KPI, in card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="flex shrink-0 flex-col rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]"
      >
        <span className="mb-1 block font-bold text-[9px] text-nham-stone uppercase tracking-[0.2em]">
          {t('caloriesRemaining')}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-semibold text-[60px] text-nham-text tabular-nums leading-none tracking-[-0.03em]"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {remaining.toLocaleString()}
          </span>
          <span
            className="text-nham-text-muted text-sm italic"
            style={{ fontFamily: 'Lora, serif' }}
          >
            kcal
          </span>
        </div>
      </motion.div>

      {/* Pace + Deficit + Protein — bare, tightly packed */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex shrink-0 items-start gap-4"
      >
        <PaceCard verdict={verdict} />
        <div className="mt-3 w-px self-stretch bg-nham-border/40" />
        <DeficitCard stats={stats} weeklyRate={verdict.weeklyRate} />
      </motion.div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Weight Logging */}
      <div className="w-[340px] shrink-0">
        <WeightCard weightSummary={weightSummary} />
      </div>
    </div>
  );
}

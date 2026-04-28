'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import type {
  PaceStatus,
  StatsData,
  VerdictData,
} from '@/components/dashboard/types';

const STATUS_CONFIG: Record<
  PaceStatus,
  { label: string; Icon: typeof TrendingDown; color: string }
> = {
  on_pace: {
    label: 'On pace',
    Icon: TrendingDown,
    color: 'var(--nham-success)',
  },
  ahead: { label: 'Ahead', Icon: TrendingDown, color: 'var(--nham-success)' },
  behind: { label: 'Behind', Icon: TrendingUp, color: 'var(--nham-danger)' },
  too_early: {
    label: 'Too early to tell',
    Icon: Minus,
    color: 'var(--nham-stone)',
  },
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface PaceCardProps {
  verdict: VerdictData;
}

export function PaceCard({ verdict }: PaceCardProps) {
  const { weeklyRate, totalDelta, planStartDate, status } = verdict;
  const { label, Icon, color } = STATUS_CONFIG[status];
  const isBehind = status === 'behind';
  const valueColor = isBehind ? 'var(--nham-danger)' : 'var(--nham-text)';

  const rateSign = weeklyRate >= 0 ? '+' : '';
  const deltaSign = totalDelta >= 0 ? '+' : '';

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.2em]">
          Current Pace
        </span>
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px"
          style={{
            backgroundColor: `${color}14`,
            borderColor: `${color}35`,
          }}
        >
          <Icon className="h-2.5 w-2.5" style={{ color }} />
          <span className="font-bold text-[7px] text-nham-text uppercase tracking-widest">
            {label}
          </span>
        </motion.span>
      </div>
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span
          className="font-semibold text-[56px] leading-[0.9] tracking-[-0.03em]"
          style={{ fontFamily: 'Lora, serif', color: valueColor }}
        >
          {rateSign}
          {weeklyRate}
        </span>
        <span
          className="text-nham-text-muted text-sm italic"
          style={{ fontFamily: 'Lora, serif' }}
        >
          kg / wk
        </span>
      </div>
      <p className="mt-auto pt-1 text-[11px] text-nham-text-muted">
        <span
          className="font-semibold"
          style={{ color: valueColor }}
        >
          {deltaSign}
          {totalDelta} kg
        </span>{' '}
        since {formatDate(planStartDate)}
      </p>
    </div>
  );
}

interface DeficitCardProps {
  stats: StatsData;
  weeklyRate: number;
}

export function DeficitCard({ stats, weeklyRate }: DeficitCardProps) {
  const deficit = stats.avgDeficit;
  const EXCESSIVE_DEFICIT_THRESHOLD = 500; // kcal/day
  const isSurplus = deficit < 0;
  const goalType = weeklyRate < 0 ? 'cutting' : weeklyRate > 0 ? 'bulking' : 'flat';
  const offTrack =
    (goalType === 'cutting' && isSurplus) ||
    (goalType === 'bulking' && deficit > 0) ||
    (goalType === 'flat' && isSurplus);
  const isExcessiveDeficit = deficit >= EXCESSIVE_DEFICIT_THRESHOLD;
  const labelColor = offTrack || isExcessiveDeficit ? 'var(--nham-danger)' : 'var(--nham-success)';
  return (
    <div className="flex h-full flex-col justify-end">
      <div className="mb-1 flex items-center gap-2">
        <span className="block font-bold text-[9px] text-nham-stone uppercase tracking-[0.2em]">
          Avg Daily Deficit
        </span>
        {offTrack && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: `${labelColor}14`, color: labelColor }}
          >
            Off track
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="font-semibold text-[30px] tabular-nums leading-[0.9] tracking-[-0.03em]"
          style={{ fontFamily: 'Lora, serif', color: offTrack || isExcessiveDeficit ? 'var(--nham-danger)' : 'var(--nham-success)' }}
        >
          {deficit < 0 ? '+' : '-'}{Math.abs(deficit)}
        </span>
        <span
          className="text-nham-text-muted text-xs italic"
          style={{ fontFamily: 'Lora, serif' }}
        >
          kcal / day
        </span>
      </div>
      <p className="mt-1 text-[11px] text-nham-text-muted">
        Target: ~500 kcal/day
      </p>
    </div>
  );
}

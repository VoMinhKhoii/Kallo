'use client';

import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import type { NutrientCardData } from '@/lib/nutrition/types';
import { cn } from '@/lib/utils';
import { shouldShowExceed } from '../primitives/helpers';
import { NutrientDetail } from './nutrient-detail';

interface NutrientRowProps {
  card: NutrientCardData;
}

const STATUS_COLORS: Record<string, string> = {
  on_target: 'var(--nham-heatmap-on-target, #6b7f5e)',
  close: 'var(--nham-heatmap-close, #8b7355)',
  slight: 'var(--nham-heatmap-slight, #c9a87c)',
  moderate: 'var(--nham-heatmap-moderate, #b87a4f)',
  far: 'var(--nham-heatmap-far, #9c5a3c)',
};

function statusKeyFor(card: NutrientCardData): keyof typeof STATUS_COLORS {
  if (card.percentOfTarget === null) return 'slight';
  const pct = card.percentOfTarget;
  const type = card.nutrientType;

  if (type === 'floor') {
    if (pct >= 90) return 'on_target';
    if (pct >= 70) return 'close';
    if (pct >= 50) return 'slight';
    if (pct >= 30) return 'moderate';
    return 'far';
  }

  if (type === 'ceiling') {
    if (pct > 100) return 'far';
    if (pct >= 90) return 'on_target';
    if (pct >= 70) return 'close';
    if (pct >= 50) return 'slight';
    return 'moderate';
  }

  // range: ±10% green, ±20% close, ±30% slight, beyond → moderate/far
  const delta = Math.abs(pct - 100);
  if (delta <= 10) return 'on_target';
  if (delta <= 20) return 'close';
  if (delta <= 30) return 'slight';
  if (delta <= 50) return 'moderate';
  return 'far';
}

export function NutrientRow({ card }: NutrientRowProps) {
  const t = useTranslations('nutrition');
  const tRoot = useTranslations();
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const labelId = useId();
  const figureId = useId();
  const label = tRoot(card.labelKey);
  const isLimited =
    card.displayState === 'limited_data' ||
    card.displayState === 'insufficient_data';
  const hasNoTarget = card.percentOfTarget === null;
  const dotColor =
    isLimited || hasNoTarget
      ? 'var(--nham-stone)'
      : STATUS_COLORS[statusKeyFor(card)];

  const showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);

  let figure: string;
  if (card.displayState === 'insufficient_data') {
    figure = t('steady.limited');
  } else if (card.percentOfTarget === null) {
    figure = t('steady.noTarget');
  } else if (showExceed && card.percentOfTarget > 100) {
    figure = `+${Math.round(card.percentOfTarget - 100)}%`;
  } else {
    figure = t('steady.percent', { value: Math.round(card.percentOfTarget) });
  }

  return (
    <li className="border-nham-border/40 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={detailId}
        aria-labelledby={`${labelId} ${figureId}`}
        className="group flex w-full touch-manipulation items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-nham-hover/40 focus-visible:bg-nham-hover/40 focus-visible:outline-none sm:px-5"
      >
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <span id={labelId} className="flex-1 truncate text-nham-text text-sm">
          {label}
        </span>
        <span
          id={figureId}
          className={cn(
            'shrink-0 text-xs tabular-nums',
            showExceed
              ? 'text-nham-danger'
              : isLimited
                ? 'text-nham-text-muted'
                : 'text-nham-text'
          )}
        >
          {figure}
        </span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-nham-stone"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </motion.span>
      </button>

      <motion.div
        id={detailId}
        role="region"
        aria-labelledby={labelId}
        aria-hidden={!open}
        initial={false}
        animate={
          open ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }
        }
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <div inert={!open} className="px-4 pb-4 sm:px-5">
          <NutrientDetail card={card} />
        </div>
      </motion.div>
    </li>
  );
}

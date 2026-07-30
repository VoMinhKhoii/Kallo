'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { HeroDemoFixture } from '@/components/landing-page/hero/hero-demo-fixtures';

/**
 * The analysis card the hero demo reveals — ingredient rows, the calorie total,
 * and the conversion gate that turns "nice demo" into an account.
 */
export function HeroResultCard({
  fixture,
  onSave,
}: {
  fixture: HeroDemoFixture;
  onSave: () => void;
}) {
  const t = useTranslations('landing.hero');
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={fixture.id + fixture.text}
      initial={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 0, y: 20, scale: 0.95 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-full max-w-full"
    >
      <div className="rounded-2xl rounded-bl-sm border border-nham-border/30 bg-white p-3 shadow-lg shadow-nham-accent/5 sm:p-4">
        <div className="mb-2 flex items-center justify-between border-nham-hover border-b pb-2">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-nham-ink">
              <Sparkles className="h-2.5 w-2.5 text-nham-accent" />
            </div>
            <span className="font-bold text-[9px] text-nham-text uppercase tracking-wide sm:text-[10px]">
              {t('demo.analysis')}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          {fixture.rows.map((item, idx) => (
            <motion.div
              initial={
                prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }
              }
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              key={item.name}
              className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
            >
              <span className="truncate text-nham-text-soft">{item.name}</span>
              <span className="shrink-0 font-mono font-semibold text-nham-text text-xs">
                {item.cal}
              </span>
            </motion.div>
          ))}

          <div className="mt-1 flex items-center justify-between border-nham-hover border-t pt-2">
            <span className="font-normal font-serif text-nham-text text-xs sm:text-sm">
              {t('demo.totalCalories')}
            </span>
            <span className="font-bold font-mono text-base text-nham-text sm:text-lg">
              {fixture.total}
            </span>
          </div>

          {/* Conversion gate: saving the meal needs an account. */}
          <button
            type="button"
            onClick={onSave}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-nham-ink py-2 font-medium text-[11px] text-white transition-transform active:scale-[0.98] sm:text-xs"
          >
            {t('demo.save')}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { VerdictData } from '@/components/dashboard/types';

interface ProteinConsistencyCardProps {
  verdict: VerdictData;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function ProteinConsistencyCard({
  verdict,
}: ProteinConsistencyCardProps) {
  const t = useTranslations('dashboard');
  const { proteinDays } = verdict;
  const daysHit = proteinDays.filter(Boolean).length;

  return (
    <div className="flex h-full flex-col">
      <span className="mb-1 block font-bold text-[9px] text-nham-stone uppercase tracking-[0.2em]">
        {t('protein')}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-[28px] text-nham-text leading-none"
          style={{ fontFamily: 'Lora, serif' }}
        >
          {daysHit}
        </span>
        <span
          className="text-[14px] text-nham-text-muted italic"
          style={{ fontFamily: 'Lora, serif' }}
        >
          / {proteinDays.length} days
        </span>
      </div>
      <div className="mt-auto flex gap-2.5 pt-1">
        {proteinDays.map((hit, i) => (
          <div
            key={`bar-${DAY_LABELS[i]}-${i}`}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="relative h-[32px] w-[10px] overflow-hidden rounded-full bg-nham-hover">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: hit ? '100%' : '25%' }}
                transition={{
                  duration: 0.8,
                  delay: 0.6 + i * 0.05,
                  ease: 'easeOut',
                }}
                className="absolute inset-x-0 bottom-0 rounded-full"
                style={{
                  backgroundColor: hit
                    ? 'var(--nham-text)'
                    : 'var(--nham-bar-miss)',
                }}
              />
            </div>
            <span className="font-bold text-[8px] text-nham-stone uppercase tracking-widest">
              {DAY_LABELS[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

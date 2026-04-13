'use client';

import { Check, Scale } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { StatsData, VerdictData } from '@/components/dashboard/types';

interface WeightCardProps {
  stats: StatsData;
  verdict: VerdictData;
}

export function WeightCard({ stats, verdict }: WeightCardProps) {
  const [weightInput, setWeightInput] = useState('');
  const [saved, setSaved] = useState(false);

  const alreadyLogged = stats.todayWeight !== null;

  const handleSave = () => {
    if (!weightInput.trim()) return;
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setWeightInput('');
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex h-full flex-col rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]"
    >
      {/* Weight logging */}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-nham-accent" />
          <span className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.15em]">
            {alreadyLogged ? "Today's Weight" : 'Morning Weight'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              step="0.1"
              placeholder={String(stats.weightPlaceholder)}
              value={alreadyLogged ? String(stats.todayWeight) : weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              disabled={alreadyLogged}
              className="w-full rounded-xl border border-nham-border border-dashed bg-nham-surface px-4 py-2 font-mono text-[15px] text-nham-text outline-none transition-all placeholder:text-nham-border focus:border-nham-accent focus:ring-2 focus:ring-nham-accent/20 disabled:cursor-default disabled:border-solid disabled:opacity-70"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-nham-stone">
              kg
            </span>
          </div>
          {!alreadyLogged && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!weightInput}
              className={`rounded-xl px-3 py-2 font-bold text-xs tracking-wide transition-all ${
                saved
                  ? 'bg-[#7CA368] text-white shadow-sm'
                  : weightInput
                    ? 'bg-nham-btn text-white shadow-sm hover:bg-nham-btn-hover'
                    : 'cursor-not-allowed bg-nham-hover text-nham-stone'
              }`}
            >
              {saved ? <Check className="h-3.5 w-3.5" /> : 'Save'}
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          {!alreadyLogged && (
            <p className="text-[9px] text-nham-stone">
              Last: {verdict.currentWeight} kg
            </p>
          )}
          <p className="ml-auto text-[9px] text-nham-stone">
            <span className="font-semibold text-nham-text">
              {stats.daysLogged}
            </span>{' '}
            of last 30 days logged
          </p>
        </div>
      </div>
    </motion.div>
  );
}

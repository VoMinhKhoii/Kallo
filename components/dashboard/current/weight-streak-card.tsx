'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Scale } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { StatsData, VerdictData } from '@/components/dashboard/types';
import { cn } from '@/lib/utils';

interface WeightCardProps {
  stats: StatsData;
  verdict: VerdictData;
}

export function WeightCard({ stats, verdict }: WeightCardProps) {
  const t = useTranslations('dashboard.weightCard');
  const tc = useTranslations('common');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weightSchema = useMemo(
    () =>
      z.object({
        weight: z
          .string()
          .min(1, t('required'))
          .refine((value) => {
            const numericValue = Number(value);
            return (
              !Number.isNaN(numericValue) &&
              numericValue > 0 &&
              numericValue < 500
            );
          }, t('invalid')),
      }),
    [t]
  );

  type WeightForm = z.infer<typeof weightSchema>;

  const alreadyLogged = stats.todayWeight !== null;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<WeightForm>({
    resolver: zodResolver(weightSchema),
    defaultValues: { weight: '' },
  });

  const watchedWeight = watch('weight');

  // Show validation errors via toast
  useEffect(() => {
    if (errors.weight) toast.error(errors.weight.message);
  }, [errors.weight]);

  // Clear timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onSubmit = () => {
    setSaved(true);
    timerRef.current = setTimeout(() => {
      setSaved(false);
      reset();
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
            {alreadyLogged ? t('todaysWeight') : t('morningWeight')}
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit, () => toast.error(t('invalid')))}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              {...register('weight')}
              type="number"
              step="0.1"
              placeholder={String(stats.weightPlaceholder)}
              value={alreadyLogged ? String(stats.todayWeight) : undefined}
              disabled={alreadyLogged}
              className="w-full rounded-xl border border-nham-border border-dashed bg-nham-surface px-4 py-2 font-mono text-[15px] text-nham-text outline-none transition-all placeholder:text-nham-border focus:border-nham-accent focus:ring-2 focus:ring-nham-accent/20 disabled:cursor-default disabled:border-solid disabled:opacity-70"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-nham-stone">
              kg
            </span>
          </div>
          {!alreadyLogged && (
            <button
              type="submit"
              disabled={!watchedWeight}
              className={cn(
                'rounded-xl px-3 py-2 font-bold text-xs tracking-wide transition-all',
                saved
                  ? 'bg-nham-success text-white shadow-sm'
                  : watchedWeight
                    ? 'bg-nham-btn text-white shadow-sm hover:bg-nham-btn-hover'
                    : 'cursor-not-allowed bg-nham-hover text-nham-stone'
              )}
            >
              {saved ? <Check className="h-3.5 w-3.5" /> : tc('save')}
            </button>
          )}
        </form>
        <div className="flex items-center justify-between">
          {!alreadyLogged && (
            <p className="text-[9px] text-nham-stone">
              {t('lastLogged', { weight: verdict.currentWeight })}
            </p>
          )}
          <p className="ml-auto text-[9px] text-nham-stone">
            {t('loggedDays', { count: stats.daysLogged, total: 30 })}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

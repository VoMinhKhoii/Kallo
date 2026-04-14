'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Scale } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { WeightSummaryData } from '@/lib/types/weight';
import { useLogWeight } from '@/hooks/use-weight-mutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { weightLogSchema, type WeightLogInput } from '@/lib/validation';

interface WeightCardProps {
  weightSummary: WeightSummaryData | undefined;
}

function todayDateString(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function WeightCard({ weightSummary }: WeightCardProps) {
  const logWeightMutation = useLogWeight();
  const currentWeight = weightSummary?.currentWeight ?? 65;
  const todayWeight = weightSummary?.todayWeight ?? null;
  const daysLogged = weightSummary?.daysLogged ?? 0;
  const rangeLabel = weightSummary?.range === '90d' ? '90 days' : '30 days';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WeightLogInput>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: {
      loggedDate: todayDateString(),
      weightKg: currentWeight,
    },
  });

  useEffect(() => {
    reset({
      loggedDate: todayDateString(),
      weightKg: todayWeight ?? currentWeight,
    });
  }, [currentWeight, reset, todayWeight]);

  const onSubmit = async (values: WeightLogInput) => {
    await logWeightMutation.mutateAsync(values);
    toast.success('Đã lưu cân nặng.');
    reset(values);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex h-full flex-col rounded-2xl border border-nham-border/60 bg-card p-4 shadow-[0_4px_24px_rgba(44,36,22,0.04)]"
    >
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-nham-accent" />
          <span className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.15em]">
            Weight Log
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit, () =>
            toast.error('Vui lòng kiểm tra lại ngày và cân nặng.')
          )}
          className="space-y-2"
        >
          <div className="grid grid-cols-[1fr_112px_auto] gap-2">
            <Input
              {...register('loggedDate')}
              type="date"
              className={cn(
                'rounded-xl border-nham-border border-dashed bg-nham-surface px-3 text-[12px] text-nham-text shadow-none',
                errors.loggedDate && 'border-destructive'
              )}
            />

            <div className="relative">
              <Input
                {...register('weightKg', { valueAsNumber: true })}
                type="number"
                step="0.1"
                min="30"
                max="300"
                placeholder={currentWeight.toFixed(1)}
                className={cn(
                  'rounded-xl border-nham-border border-dashed bg-nham-surface px-3 pr-8 font-mono text-[14px] text-nham-text shadow-none',
                  errors.weightKg && 'border-destructive'
                )}
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-nham-stone">
                kg
              </span>
            </div>

            <Button
              type="submit"
              size="xs"
              disabled={logWeightMutation.isPending}
              className={cn(
                'rounded-xl px-3 py-2 font-bold text-xs tracking-wide transition-all',
                'bg-nham-btn text-white shadow-sm hover:bg-nham-btn-hover'
              )}
            >
              {logWeightMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {(errors.loggedDate || errors.weightKg) && (
            <p className="text-[10px] text-destructive">
              {errors.loggedDate?.message ?? errors.weightKg?.message}
            </p>
          )}
        </form>

        <div className="flex items-center justify-between">
          <p className="text-[9px] text-nham-stone">
            <span className="font-semibold text-nham-text">
              {(todayWeight ?? currentWeight).toFixed(1)}
            </span>{' '}
            kg current
          </p>
          <p className="text-[9px] text-nham-stone">
            <span className="font-semibold text-nham-text">{daysLogged}</span>{' '}
            logs in last {rangeLabel}
          </p>
        </div>

        <div className="flex items-center justify-between text-[9px] text-nham-stone">
          <span>
            Goal line: {weightSummary?.goalDirection === 'up' ? 'up' : 'down'}
          </span>
          <span>
            Start: {weightSummary?.periodStartWeight ?? currentWeight} kg
          </span>
        </div>

        {todayWeight !== null && (
          <p className="text-[9px] text-nham-stone">
            Today logged: {todayWeight} kg
          </p>
        )}
      </div>
    </motion.div>
  );
}

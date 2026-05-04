'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Scale } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogWeight } from '@/hooks/use-weight-mutations';
import { cn } from '@/lib/utils';
import { type WeightLogInput, weightLogSchema } from '@/lib/validation';

interface CompactWeightLogProps {
  currentWeight: number;
  todayWeight: number | null | undefined;
}

function todayDateString(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function CompactWeightLog({
  currentWeight,
  todayWeight,
}: CompactWeightLogProps) {
  const t = useTranslations('dashboard');
  const logWeightMutation = useLogWeight();
  const hasTodayWeight = typeof todayWeight === 'number';
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<WeightLogInput>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: {
      loggedDate: todayDateString(),
      weightKg: todayWeight ?? currentWeight,
    },
  });

  useEffect(() => {
    if (!isDirty) {
      reset({
        loggedDate: todayDateString(),
        weightKg: todayWeight ?? currentWeight,
      });
    }
  }, [currentWeight, reset, todayWeight, isDirty]);

  const onSubmit = async (values: WeightLogInput) => {
    try {
      await logWeightMutation.mutateAsync(values);
      toast.success(t('weightCard.saved'));
      reset(values);
    } catch (error) {
      console.error('[dashboard] compact weight log failed', error);
    }
  };
  const errorMessage = errors.loggedDate?.message ?? errors.weightKg?.message;
  const errorId = errorMessage ? 'compact-weight-error' : undefined;

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (invalidErrors) => {
        if (invalidErrors.weightKg) {
          setFocus('weightKg');
        } else if (invalidErrors.loggedDate) {
          setFocus('loggedDate');
        }
        toast.error(t('weightCard.invalidValue'));
      })}
      aria-busy={logWeightMutation.isPending}
      className="flex min-h-0 flex-col justify-center rounded-[1.25rem] border border-nham-border/60 bg-nham-surface/70 p-2"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 text-nham-accent" />
        <span className="font-bold text-[9px] text-nham-stone uppercase tracking-[0.15em]">
          {hasTodayWeight
            ? t('weightCard.todaysWeight')
            : t('weightCard.logWeight')}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="compact-weight-kg" className="sr-only">
          {t('weightCard.inputLabel')}
        </label>
        <div className="relative flex-1">
          <Input
            id="compact-weight-kg"
            {...register('weightKg', { valueAsNumber: true })}
            type="number"
            inputMode="decimal"
            autoComplete="off"
            step="0.1"
            min="30"
            max="300"
            aria-invalid={Boolean(errors.weightKg)}
            aria-describedby={errorId}
            className={cn(
              'h-9 rounded-xl border-nham-border bg-card pr-8 font-mono text-sm shadow-none',
              errors.weightKg && 'border-destructive'
            )}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-nham-stone">
            {t('units.kg')}
          </span>
        </div>
        <input type="hidden" {...register('loggedDate')} />
        <Button
          type="submit"
          size="xs"
          disabled={logWeightMutation.isPending}
          aria-busy={logWeightMutation.isPending}
          className="h-9 rounded-xl bg-nham-btn px-3 text-white hover:bg-nham-btn-hover"
        >
          {logWeightMutation.isPending ? t('saving') : t('save')}
        </Button>
      </div>
      {errorMessage && (
        <p
          id="compact-weight-error"
          role="alert"
          className="mt-1 text-[10px] text-destructive"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

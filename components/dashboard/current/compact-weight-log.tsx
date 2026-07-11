'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLogWeight } from '@/hooks/weight/use-weight-mutations';
import { cn, parseDecimalInput } from '@/lib/utils';
import { type WeightLogInput, weightLogSchema } from '@/lib/validation';

interface CompactWeightLogProps {
  currentWeight: number;
  todayWeight: number | null | undefined;
  todayDate: string;
  /** Focus the weight input on mount (e.g. when opened inside a popover). */
  autoFocus?: boolean;
  /** Called after a successful save (e.g. to close a hosting popover). */
  onSaved?: () => void;
}

export function CompactWeightLog({
  currentWeight,
  todayWeight,
  todayDate,
  autoFocus = false,
  onSaved,
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
      loggedDate: todayDate,
      weightKg: todayWeight ?? currentWeight,
    },
  });

  useEffect(() => {
    if (!isDirty) {
      reset({
        loggedDate: todayDate,
        weightKg: todayWeight ?? currentWeight,
      });
    }
  }, [currentWeight, reset, todayDate, todayWeight, isDirty]);

  useEffect(() => {
    if (autoFocus) {
      setFocus('weightKg');
    }
  }, [autoFocus, setFocus]);

  const onSubmit = async (values: WeightLogInput) => {
    try {
      await logWeightMutation.mutateAsync(values);
      toast.success(t('weightCard.saved'));
      reset(values);
      onSaved?.();
    } catch (error) {
      console.error('[dashboard] compact weight log failed', error);
      toast.error(t('weightCard.saveFailed'));
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
      className="flex flex-col"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-medium text-nham-text-muted text-xs uppercase tracking-[0.08em]">
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
            {...register('weightKg', { setValueAs: parseDecimalInput })}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={Boolean(errors.weightKg)}
            aria-describedby={errorId}
            className={cn(
              'h-9 rounded-xl border-nham-border bg-card pr-8 font-mono text-sm shadow-none transition-colors hover:border-nham-accent/50',
              errors.weightKg && 'border-nham-danger hover:border-nham-danger'
            )}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-nham-text-muted text-xs">
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
          {logWeightMutation.isPending
            ? t('saving')
            : hasTodayWeight
              ? t('weightCard.update')
              : t('save')}
        </Button>
      </div>
      {hasTodayWeight && !errorMessage && (
        <p className="mt-1.5 text-nham-text-muted text-xs">
          {t('weightCard.editHint')}
        </p>
      )}
      {errorMessage && (
        <p
          id="compact-weight-error"
          role="alert"
          className="mt-1.5 text-nham-danger text-xs"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}

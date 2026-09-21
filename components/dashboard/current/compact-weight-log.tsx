'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLogWeight } from '@/hooks/weight/use-weight-mutations';
import { parseDecimalInput } from '@/lib/core/text/parse-decimal';
import { cn } from '@/lib/core/ui/cn';
import {
  type WeightLogInput,
  weightLogSchema,
} from '@/lib/core/validation/weight';

interface CompactWeightLogProps {
  currentWeight: number;
  todayWeight: number | null | undefined;
  todayDate: string;
  /** Focus the weight input on mount when its dialog opens. */
  autoFocus?: boolean;
  /** Called after a successful save to close the hosting dialog. */
  onSaved?: () => void;
  /** Closes the hosting dialog without saving. */
  onCancel: () => void;
}

export function CompactWeightLog({
  currentWeight,
  todayWeight,
  todayDate,
  autoFocus = false,
  onSaved,
  onCancel,
}: CompactWeightLogProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
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
      className="flex min-h-0 flex-col"
    >
      <div className="px-[22px] pt-4">
        <label htmlFor="compact-weight-kg" className="sr-only">
          {t('weightCard.inputLabel')}
        </label>
        <div className="relative">
          <Input
            id="compact-weight-kg"
            {...register('weightKg', { setValueAs: parseDecimalInput })}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={Boolean(errors.weightKg)}
            aria-describedby={errorId}
            className={cn(
              'h-11 rounded-xl border-kallo-border bg-card pr-10 font-mono text-base shadow-none transition-colors hover:border-kallo-accent/50',
              errors.weightKg && 'border-kallo-danger hover:border-kallo-danger'
            )}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-kallo-text-muted text-xs">
            {t('units.kg')}
          </span>
        </div>
        <input type="hidden" {...register('loggedDate')} />
        {hasTodayWeight && !errorMessage && (
          <p className="mt-1.5 text-kallo-text-muted text-xs">
            {t('weightCard.editHint')}
          </p>
        )}
        {errorMessage && (
          <p
            id="compact-weight-error"
            role="alert"
            className="mt-1.5 text-kallo-danger text-xs"
          >
            {errorMessage}
          </p>
        )}
      </div>
      <DialogFooter className="mt-4 shrink-0 items-center border-kallo-border/60 border-t px-[22px] py-3.5">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon('cancel')}
        </Button>
        <Button
          type="submit"
          disabled={logWeightMutation.isPending}
          aria-busy={logWeightMutation.isPending}
          className="bg-kallo-btn text-white hover:bg-kallo-btn-hover"
        >
          {logWeightMutation.isPending
            ? t('saving')
            : hasTodayWeight
              ? t('weightCard.update')
              : t('save')}
        </Button>
      </DialogFooter>
    </form>
  );
}

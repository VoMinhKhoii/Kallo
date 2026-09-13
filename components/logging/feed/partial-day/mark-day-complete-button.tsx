'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MarkDayCompleteButtonProps {
  /** The day's logged calories — what the trends will count it at. */
  calories: number;
  onConfirm: () => void;
  isPending: boolean;
}

/**
 * The way out for a day that really was light: attest it was fully logged.
 *
 * Wears the same outlined capsule as the sibling partial-yesterday prompt
 * rather than a filled CTA. The notice is an observation, not a call to
 * action — the primary fix is still to type the missing meal — so this reads
 * as the second option it is.
 *
 * The dialog is NOT destructive-styled: nothing is deleted, and terracotta is
 * reserved in this palette for "something is gone", never for "your numbers
 * are off". The irreversibility is carried by the body copy, which is where a
 * user actually reads it.
 */
export function MarkDayCompleteButton({
  calories,
  onConfirm,
  isPending,
}: MarkDayCompleteButtonProps) {
  const t = useTranslations('logging.feedArea.partialDayNotice');

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className="mt-3 inline-flex min-h-8 touch-manipulation items-center gap-2 rounded-full border border-kallo-border/60 px-3 py-1.5 font-medium font-sans-display text-kallo-text text-sm transition-colors hover:border-kallo-accent/50 hover:bg-kallo-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kallo-surface disabled:opacity-60"
        >
          <Check className="size-4" aria-hidden="true" />
          {t('markComplete')}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-[#E8E6DC] bg-white text-[#141413]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-normal font-sans-display text-[18px]">
            {t('confirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="font-sans-display text-[#6E6D66] text-[13px]">
            {t('confirmBody', { calories })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('confirmCancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('confirmAccept')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

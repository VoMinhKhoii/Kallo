'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CompactWeightLog } from '@/components/dashboard/current/compact-weight-log';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface WeightLogDialogProps {
  currentWeight: number;
  todayWeight: number | null | undefined;
  todayDate: string;
}

/**
 * The Progress card's log affordance. It follows the established web dialog
 * anatomy used by Share Meal: editorial title, top-right close, focused body,
 * and a separated action footer. Flutter keeps its native bottom sheet.
 */
export function WeightLogDialog({
  currentWeight,
  todayWeight,
  todayDate,
}: WeightLogDialogProps) {
  const t = useTranslations('dashboard');
  const [open, setOpen] = useState(false);
  const hasTodayWeight = typeof todayWeight === 'number';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="xs"
          className="h-9 shrink-0 gap-1.5 rounded-xl bg-kallo-btn px-3 text-white hover:bg-kallo-btn-hover"
        >
          <Plus aria-hidden className="h-4 w-4" />
          {hasTodayWeight ? t('weightCard.update') : t('weightCard.logWeight')}
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[min(90dvh,44rem)] flex-col gap-0 rounded-2xl border-kallo-border/60 bg-white p-0 sm:max-w-md"
      >
        <DialogHeader className="shrink-0 px-[22px] pt-5">
          <DialogTitle className="font-serif text-[22px] text-kallo-text">
            {t('weightCard.logWeight')}
          </DialogTitle>
        </DialogHeader>
        <CompactWeightLog
          currentWeight={currentWeight}
          todayWeight={todayWeight}
          todayDate={todayDate}
          autoFocus
          onCancel={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

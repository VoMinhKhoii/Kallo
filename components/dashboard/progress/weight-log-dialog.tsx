'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CompactWeightLog } from '@/components/dashboard/current/compact-weight-log';
import { ResponsiveModal } from '@/components/shared/responsive-modal';
import { Button } from '@/components/ui/button';

interface WeightLogDialogProps {
  currentWeight: number;
  todayWeight: number | null | undefined;
  todayDate: string;
}

/**
 * The Progress card's log affordance. It follows the established web dialog
 * anatomy used by Share Meal: editorial title, top-right close, focused body,
 * and a separated action footer. On phones it is a bottom sheet, like
 * Flutter's.
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
    <ResponsiveModal
      open={open}
      onOpenChange={setOpen}
      title={t('weightCard.logWeight')}
      trigger={
        <Button
          size="xs"
          className="h-9 shrink-0 gap-1.5 rounded-xl bg-kallo-btn px-3 text-white hover:bg-kallo-btn-hover"
        >
          <Plus aria-hidden className="h-4 w-4" />
          {hasTodayWeight ? t('weightCard.update') : t('weightCard.logWeight')}
        </Button>
      }
      dialogClassName="sm:max-w-md"
    >
      <CompactWeightLog
        currentWeight={currentWeight}
        todayWeight={todayWeight}
        todayDate={todayDate}
        autoFocus
        onCancel={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </ResponsiveModal>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { CompactWeightLog } from '@/components/dashboard/current/compact-weight-log';
import { ResponsiveModal } from '@/components/shared/responsive-modal';
import { useWeightSummary } from '@/hooks/weight/use-weight-summary';
import { getTodayDateString } from '@/lib/domain/dashboard/today';

interface QuickWeightSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The weigh-in sheet behind the tab bar's "+" → "Log weight", the web twin of
 * Flutter's `showWeightLogSheet`. Unlike `WeightLogDialog` it is opened from
 * outside the dashboard, so it loads the weight it prefills from itself — only
 * while open, off the same cached summary query the Progress card reads.
 */
export function QuickWeightSheet({
  open,
  onOpenChange,
}: QuickWeightSheetProps) {
  const t = useTranslations('dashboard');
  const tAdd = useTranslations('app.addSheet');
  const summary = useWeightSummary('30d', { enabled: open });

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('weightCard.logWeight')}
      dialogClassName="sm:max-w-md"
    >
      {summary.data ? (
        <CompactWeightLog
          currentWeight={summary.data.currentWeight}
          todayWeight={summary.data.todayWeight}
          todayDate={getTodayDateString()}
          autoFocus
          onCancel={() => onOpenChange(false)}
          onSaved={() => onOpenChange(false)}
        />
      ) : (
        <p
          role={summary.isError ? 'alert' : 'status'}
          className="px-[22px] py-8 text-center text-[14px] text-kallo-text-muted"
        >
          {summary.isError ? tAdd('weightError') : tAdd('weightLoading')}
        </p>
      )}
    </ResponsiveModal>
  );
}

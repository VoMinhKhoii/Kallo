'use client';

import { ChevronRight, Gauge, type LucideIcon, Utensils } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { QuickWeightSheet } from '@/components/dashboard/progress/quick-weight-sheet';
import { ResponsiveSheet } from '@/components/shared/responsive-sheet';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { useRouter } from '@/i18n/navigation';

interface MobileAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The tab bar's center "+" sheet — the web twin of Flutter's `showAddSheet`
 * (`shell/nav/add_sheet.dart`): two 64px rows, "Log a meal" and "Log weight",
 * the app's one add entry point. Logging a meal opens the logging feed, whose
 * composer is the web's quick-log; weight opens the weigh-in sheet in place.
 */
export function MobileAddSheet({ open, onOpenChange }: MobileAddSheetProps) {
  const t = useTranslations('app.addSheet');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [weightOpen, setWeightOpen] = useState(false);

  return (
    <>
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title={t('title')}
      >
        <ResponsiveSheetHeader
          title={t('title')}
          closeLabel={tCommon('close')}
          onClose={() => onOpenChange(false)}
        />
        <ul className="divide-y divide-kallo-border/70 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <AddRow
            icon={Utensils}
            label={t('logMeal')}
            hint={t('logMealHint')}
            onSelect={() => {
              onOpenChange(false);
              router.push('/logging');
            }}
          />
          <AddRow
            icon={Gauge}
            label={t('logWeight')}
            hint={t('logWeightHint')}
            onSelect={() => {
              onOpenChange(false);
              setWeightOpen(true);
            }}
          />
        </ul>
      </ResponsiveSheet>
      <QuickWeightSheet open={weightOpen} onOpenChange={setWeightOpen} />
    </>
  );
}

function AddRow({
  icon: Icon,
  label,
  hint,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-16 w-full items-center gap-3 py-2 text-left transition-colors active:bg-kallo-hover"
      >
        <Icon
          className="size-6 shrink-0 text-kallo-text"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-[16px] text-kallo-text">
            {label}
          </span>
          <span className="truncate text-[14px] text-kallo-text-muted">
            {hint}
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-kallo-text-muted"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}

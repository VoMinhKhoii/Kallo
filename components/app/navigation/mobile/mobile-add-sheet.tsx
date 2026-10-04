'use client';

import { Gauge, Plus, Utensils } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { QuickWeightSheet } from '@/components/dashboard/progress/quick-weight-sheet';
import { ResponsiveSheet } from '@/components/shared/responsive-sheet';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { useRouter } from '@/i18n/navigation';
import { MobileAddRow } from './mobile-add-row';

/**
 * The tab bar's center "+" sheet — the web twin of Flutter's `showAddSheet`
 * (`shell/nav/add_sheet.dart`): two 64px rows, "Log a meal" and "Log weight",
 * the app's one add entry point. Logging a meal opens the logging feed, whose
 * composer is the web's quick-log; weight opens the weigh-in sheet in place.
 *
 * It owns its "+" opener: registering the button as the sheet's trigger is
 * what returns focus to it on close, and the weigh-in sheet — which has no
 * trigger of its own — hands focus back to the same button.
 */
export function MobileAddSheet() {
  const t = useTranslations('app.addSheet');
  const tTab = useTranslations('app.tabBar');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const plusRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={t('title')}
        trigger={
          <button
            ref={plusRef}
            type="button"
            aria-label={tTab('add')}
            className="flex size-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--kallo-brand-apricot),var(--kallo-brand-lilac))] text-kallo-text shadow-[0_4px_12px_rgba(20,20,19,0.14)] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2} aria-hidden="true" />
          </button>
        }
      >
        <ResponsiveSheetHeader
          title={t('title')}
          closeLabel={tCommon('close')}
          onClose={() => setOpen(false)}
        />
        <ul className="divide-y divide-kallo-border/70 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <MobileAddRow
            icon={Utensils}
            label={t('logMeal')}
            hint={t('logMealHint')}
            onSelect={() => {
              setOpen(false);
              router.push('/logging');
            }}
          />
          <MobileAddRow
            icon={Gauge}
            label={t('logWeight')}
            hint={t('logWeightHint')}
            onSelect={() => {
              setOpen(false);
              setWeightOpen(true);
            }}
          />
        </ul>
      </ResponsiveSheet>
      <QuickWeightSheet
        open={weightOpen}
        onOpenChange={setWeightOpen}
        returnFocusRef={plusRef}
      />
    </>
  );
}

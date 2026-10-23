'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ResponsiveModal } from '@/components/shared/responsive-modal';
import { formatLocalizedNumber } from '@/lib/core/text/format-number';
import {
  type MealEditDraft,
  SERVING_STEP,
  stepWhole,
  sumTotals,
} from '@/lib/domain/meals/meal-edit/meal-edit-draft';
import { MealEditDish } from './meal-edit-dish';
import { MealEditStepperRow } from './meal-edit-stepper-row';
import { MealEditSummary } from './meal-edit-summary';

interface MealEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The meal as it stands when the dialog opens. */
  initial: MealEditDraft;
  /** The meal's words, under the title. */
  subtitle?: string;
  /** "Save" for a saved meal, "Done" for an unsaved one. */
  commitLabel: string;
  /** Resolves to close; throws to stay open for a retry (the caller toasts). */
  onCommit: (draft: MealEditDraft) => Promise<void> | void;
}

/**
 * Edit a meal: the whole meal on top — its calories, bar, legend and a Whole
 * meal stepper — then every dish with Servings, Amount and, for a dish with a
 * vessel, Size. A dialog on desktop, a bottom sheet on phones.
 */
export function MealEditDialog(props: MealEditDialogProps) {
  const t = useTranslations('logging.mealEdit');
  // A save in flight holds the dialog: Escape, the backdrop or the × would
  // throw the edits away if the request then failed.
  const [saving, setSaving] = useState(false);
  return (
    <ResponsiveModal
      open={props.open}
      onOpenChange={(open) => {
        if (!open && saving) return;
        props.onOpenChange(open);
      }}
      title={t('title')}
      subtitle={props.subtitle}
      dialogClassName="sm:max-w-[440px]"
      bodyClassName="px-4 pt-1 pb-[max(env(safe-area-inset-bottom),1rem)] md:px-[22px] md:pt-3 md:pb-[18px]"
    >
      {/* Remounted per open, so a cancelled edit never comes back. */}
      {props.open && (
        <MealEditBody
          key="body"
          {...props}
          saving={saving}
          setSaving={setSaving}
        />
      )}
    </ResponsiveModal>
  );
}

function MealEditBody({
  onOpenChange,
  initial,
  commitLabel,
  onCommit,
  saving,
  setSaving,
}: MealEditDialogProps & {
  saving: boolean;
  setSaving: (saving: boolean) => void;
}) {
  const t = useTranslations('logging.mealEdit');
  const locale = useLocale();
  const [draft, setDraft] = useState(initial);

  const commit = async () => {
    setSaving(true);
    try {
      await onCommit(draft);
      setSaving(false);
      onOpenChange(false);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="font-sans-display">
      <fieldset disabled={saving} className="min-w-0">
        <MealEditSummary totals={sumTotals(draft.dishes)} />
        <div className="mt-4 rounded-xl border border-kallo-border/60 bg-card px-3.5">
          <MealEditStepperRow
            label={t('wholeMeal')}
            value={`${formatLocalizedNumber(draft.whole, locale)}×`}
            minusLabel={t('lessWhole')}
            plusLabel={t('moreWhole')}
            onMinus={
              draft.whole <= SERVING_STEP
                ? undefined
                : () => setDraft(stepWhole(draft, -1))
            }
            onPlus={() => setDraft(stepWhole(draft, 1))}
          />
        </div>
        {draft.dishes.map((dish) => (
          <MealEditDish
            key={dish.key}
            draft={draft}
            dish={dish}
            onDraft={setDraft}
          />
        ))}
      </fieldset>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={saving}
          className="rounded-lg px-3 py-2 text-kallo-text-muted text-sm transition-colors hover:bg-kallo-hover/50 hover:text-kallo-text disabled:opacity-60"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={saving}
          aria-busy={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-kallo-btn px-4 py-2 font-medium text-kallo-btn-ink text-sm transition-colors hover:bg-kallo-btn-hover disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {saving ? t('saving') : commitLabel}
        </button>
      </div>
    </div>
  );
}

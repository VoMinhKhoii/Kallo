'use client';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import {
  formatGrams,
  kcalAt,
  type ManualSheetItem,
  mealSubtitle,
  sheetItemsAsRows,
} from '@/lib/domain/logging/manual-display';
import {
  formatKcal,
  manualMealTitle,
  totalsForRows,
} from '@/lib/domain/logging/manual-logging';
import { ManualAddSheet } from './manual-add-sheet';
import { ManualFoodRow, useStateWord } from './manual-food-row';
import { ManualMealTotals } from './manual-meal-totals';
import { MAX_MANUAL_ITEMS, type ManualSheetState } from './use-manual-sheet';

/**
 * The phone's manual log (approved canvas, E1) — the Flutter `ManualLogSheet`
 * on the web: the meal's name over its macro ring, the ingredients already on
 * the plate, "Add ingredient" (which stacks the search sheet over this one) and
 * Save. Header and Save stay put; only the plate between them scrolls.
 */
export function ManualMealSheet({
  open,
  onOpenChange,
  meal,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: ManualSheetState;
  /** Resolves once the meal is saved; rejects to keep the sheet open. */
  onSave: (name: string) => Promise<void>;
}) {
  const t = useTranslations('logging.manualLogging');
  const stateWord = useStateWord();
  const [saving, setSaving] = useState(false);
  const [add, setAdd] = useState<{
    open: boolean;
    session: number;
    editing: ManualSheetItem | null;
  }>({ open: false, session: 0, editing: null });
  const totals = totalsForRows(sheetItemsAsRows(meal.items));
  const full = meal.items.length >= MAX_MANUAL_ITEMS;
  const openAdd = (editing: ManualSheetItem | null) =>
    setAdd((prev) => ({ open: true, session: prev.session + 1, editing }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(meal.name);
      meal.reset();
      onOpenChange(false);
    } catch {
      // The save path has already said why (a toast); the plate stays.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      dismissible={!saving}
    >
      <DrawerContent
        aria-describedby={undefined}
        className="max-h-[90dvh] rounded-t-[34px] border-kallo-border border-t bg-kallo-track font-sans-display text-kallo-text data-[vaul-drawer-direction=bottom]:max-h-[90dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[34px] [&>div:first-child]:hidden"
      >
        <DrawerTitle className="sr-only">{t('title')}</DrawerTitle>
        {/* The grabber is drawn over the header, as on iOS: vaul's own handle
            sits ABOVE it and pushed the controls 20px off the corner they are
            concentric with. */}
        <div className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-kallo-border" />
        <ResponsiveSheetHeader
          title={t('title')}
          closeLabel={t('close')}
          closeDisabled={saving}
          onClose={() => onOpenChange(false)}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <label className="block">
            <span className="mx-1 mb-2 block text-[14px] text-kallo-text-muted">
              {t('mealName')}
            </span>
            <input
              value={meal.name}
              maxLength={200}
              disabled={saving}
              onChange={(event) => meal.setName(event.target.value)}
              placeholder={
                meal.items.length
                  ? manualMealTitle(
                      undefined,
                      meal.items.map((item) => item.ingredient.namePrimary)
                    )
                  : t('mealNameEmpty')
              }
              className="h-[52px] w-full truncate rounded-full bg-white px-[18px] text-[16px] text-kallo-text outline-none placeholder:text-kallo-text-muted"
            />
          </label>
          <div className="mt-3">
            <ManualMealTotals totals={totals} empty={meal.items.length === 0} />
          </div>
          {meal.items.length > 0 && (
            <>
              <p className="mx-1 mt-4 mb-2 text-[14px] text-kallo-text-muted">
                {t('ingredientCount', { count: meal.items.length })}
              </p>
              <div className="rounded-[22px] bg-white px-4">
                {meal.items.map((item, index) => {
                  const grams = `${formatGrams(item.grams)} g`;
                  return (
                    <div
                      key={item.id}
                      className={
                        index > 0 ? 'border-kallo-border border-t' : ''
                      }
                    >
                      <ManualFoodRow
                        name={item.ingredient.namePrimary}
                        nameLines={1}
                        subtitle={mealSubtitle(
                          item.ingredient,
                          stateWord,
                          grams
                        )}
                        kcal={formatKcal(kcalAt(item.ingredient, item.grams))}
                        quietKcal
                        label={`${item.ingredient.namePrimary}, ${grams}`}
                        onClick={saving ? undefined : () => openAdd(item)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <button
            type="button"
            disabled={saving || full}
            onClick={() => openAdd(null)}
            className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-[22px] bg-white px-4 py-2 text-left text-[16px] text-kallo-text transition-colors hover:bg-kallo-hover/40 disabled:opacity-60"
          >
            <Plus aria-hidden className="size-6 shrink-0" strokeWidth={1.5} />
            <span className="flex flex-col">
              {t('addIngredient')}
              {full && (
                <span className="text-[14px] text-kallo-text-muted">
                  {t('mealFull', { count: MAX_MANUAL_ITEMS })}
                </span>
              )}
            </span>
          </button>
        </div>
        <div className="shrink-0 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button
            type="button"
            disabled={saving || meal.items.length === 0}
            onClick={save}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-kallo-hover font-semibold text-[16px] text-kallo-text transition-colors hover:bg-kallo-border disabled:opacity-55"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t('save')}
          </button>
        </div>
        <ManualAddSheet
          key={add.session}
          open={add.open}
          onOpenChange={(next) => setAdd((prev) => ({ ...prev, open: next }))}
          meal={meal}
          editing={add.editing}
        />
      </DrawerContent>
    </Drawer>
  );
}

'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { SheetCapsuleButton } from '@/components/shared/sheet-capsule-button';
import {
  formatSize,
  initialScanAmount,
  resolveScanAmount,
  type ScanAmount,
} from '@/lib/domain/scan/amount';
import type { ScanFood } from '@/lib/domain/scan/food';
import { ScanPanel } from '../panel/panel';
import { ScanFoodHeader, ScanResultBody } from './body';
import { ScanOtherNutrients } from './other-nutrients';

const TITLE = {
  barcode: 'barcodeTitle',
  label: 'labelTitle',
  manual: 'newFood',
} as const;

/**
 * A scan result over the frozen camera — the Flutter app's `ScanResultPanel`:
 * its title, Edit, the result, and Add meal. "Other nutrients" is a second
 * level of the same panel, the product and macros kept on top. The amount is
 * the dialog's, so it survives an edit.
 */
export function ScanResultPanel({
  food,
  amount: chosen,
  saving,
  errorKey,
  onAmount,
  onClose,
  onEdit,
  onAdd,
}: {
  food: ScanFood;
  amount: ScanAmount | null;
  saving: boolean;
  /** A `logging` message key, when the last save failed. */
  errorKey: string | null;
  onAmount: (amount: ScanAmount) => void;
  onClose: () => void;
  onEdit: () => void;
  onAdd: (amount: number) => void;
}) {
  const t = useTranslations('logging');
  const [others, setOthers] = useState(false);
  const amount = chosen ?? initialScanAmount(food);
  const resolved = resolveScanAmount(amount, food);
  const subtitle = food.source === 'label' ? t('scan.fromLabel') : food.brand;

  if (others) {
    const words =
      amount.portion === 'pack'
        ? `${amount.packs} ${t('scan.packs', { count: amount.packs })}`
        : amount.portion === 'serving'
          ? `${amount.servings} ${t('scan.servings', { count: amount.servings })}`
          : null;
    const size =
      food.unit === 'serving' ? null : formatSize(resolved, food.unit);
    const inAmount = [words, size].filter(Boolean).join(' · ');
    return (
      <ScanPanel
        level="dense"
        label={t('scan.otherNutrients')}
        header={
          <ResponsiveSheetHeader
            title={t('scan.otherNutrients')}
            closeLabel={t('scan.back')}
            backLabel={t('scan.back')}
            onClose={() => setOthers(false)}
            onBack={() => setOthers(false)}
          />
        }
      >
        <ScanFoodHeader food={food} amount={resolved} subtitle={subtitle} />
        <ScanOtherNutrients
          food={food}
          amount={resolved}
          caption={t('scan.inAmount', { amount: inAmount })}
        />
      </ScanPanel>
    );
  }

  const title = t(`scan.${TITLE[food.source]}`);
  return (
    <ScanPanel
      level={
        amount.portion === 'custom' && food.unit === 'ml' ? 'dense' : 'result'
      }
      label={title}
      header={
        <ResponsiveSheetHeader
          title={title}
          closeLabel={t('scan.close')}
          closeDisabled={saving}
          onClose={onClose}
          trailing={
            <SheetCapsuleButton
              label={t('scan.edit')}
              onClick={onEdit}
              disabled={saving}
            />
          }
        />
      }
      dock={
        <div className="flex flex-col gap-2">
          {errorKey && (
            <p
              role="alert"
              className="text-center text-[14px] text-kallo-danger"
            >
              {t(errorKey)}
            </p>
          )}
          <button
            type="button"
            disabled={saving}
            aria-busy={saving}
            onClick={() => onAdd(resolved)}
            className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-kallo-hover font-semibold text-[16px] text-kallo-text transition-colors hover:bg-kallo-border disabled:opacity-70"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t('scan.addMeal')}
          </button>
        </div>
      }
    >
      <ScanResultBody
        food={food}
        amount={amount}
        subtitle={subtitle}
        disabled={saving}
        onAmount={onAmount}
        onOtherNutrients={() => setOthers(true)}
      />
    </ScanPanel>
  );
}

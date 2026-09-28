'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  COMPOSITION_COLORS,
  COMPOSITION_ICONS,
} from '@/components/shared/nutrition/composition';
import { ResponsiveSheetHeader } from '@/components/shared/responsive-sheet-header';
import { SheetCapsuleButton } from '@/components/shared/sheet-capsule-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatSize } from '@/lib/domain/scan/amount';
import {
  basesFor,
  draftToFood,
  fieldError,
  fieldTexts,
  isDraftValid,
  type ScanBasis,
} from '@/lib/domain/scan/editor';
import type { ScanFood } from '@/lib/domain/scan/food';
import {
  SCAN_MACRO_DEFINITIONS,
  SCAN_MICRONUTRIENT_DEFINITIONS,
  type ScanNutrientDefinition,
} from '@/lib/domain/scan/nutrients';
import { ScanPanel } from '../panel/scan-panel';
import { ScanEditorField } from './scan-editor-field';

const MACRO_KEY = {
  proteinGrams: 'protein',
  carbsGrams: 'carbohydrate',
  fatGrams: 'fat',
} as const;

/**
 * Edit everything about a food — its name, what its values are per, the four
 * the log requires and every other nutrient the app knows — or type one from
 * scratch ("New food"). The Flutter app's `ScanFoodEditor`. Done hands back
 * the edited food; nothing is saved until Add meal on the result.
 */
export function ScanFoodEditor({
  food,
  isNew,
  onDone,
  onCancel,
}: {
  food: ScanFood;
  isNew: boolean;
  onDone: (food: ScanFood) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('logging');
  const [name, setName] = useState(food.name);
  const [basis, setBasis] = useState<ScanBasis>({
    amount: food.basisAmount,
    unit: food.unit,
  });
  const [fields, setFields] = useState(() => fieldTexts(food.values));
  const valid = isDraftValid(name, fields);
  const basisLabel = (b: ScanBasis) =>
    b.unit === 'serving'
      ? `${b.amount} ${t('scan.servings', { count: b.amount })}`
      : formatSize(b.amount, b.unit);

  const field = (d: ScanNutrientDefinition) => {
    const macro = MACRO_KEY[d.key as keyof typeof MACRO_KEY];
    return (
      <ScanEditorField
        key={d.key}
        label={t(`ocrNutrients.${d.labelKey}`)}
        unit={d.unit}
        value={fields[d.key]}
        error={fieldError(d.key, fields[d.key])}
        icon={macro ? COMPOSITION_ICONS[macro] : undefined}
        iconColor={macro ? COMPOSITION_COLORS[macro] : undefined}
        onChange={(value) => setFields((f) => ({ ...f, [d.key]: value }))}
      />
    );
  };
  const caption = (text: string) => (
    <h3 className="px-4 pt-5 pb-1.5 text-[14px] text-kallo-text-muted">
      {text}
    </h3>
  );

  return (
    <ScanPanel
      level="full"
      label={t(isNew ? 'scan.newFood' : 'scan.edit')}
      header={
        <ResponsiveSheetHeader
          title={t(isNew ? 'scan.newFood' : 'scan.edit')}
          closeLabel={t('scan.close')}
          onClose={onCancel}
          trailing={
            <SheetCapsuleButton
              label={t('scan.done')}
              disabled={!valid}
              onClick={() => onDone(draftToFood(food, { name, basis, fields }))}
            />
          }
        />
      }
    >
      <input
        aria-label={t('scan.foodName')}
        placeholder={t('scan.foodName')}
        value={name}
        maxLength={200}
        onChange={(event) => setName(event.target.value)}
        className="h-[52px] w-full rounded-[22px] bg-white px-4 text-[16px] text-kallo-text outline-none placeholder:text-kallo-text-muted"
      />
      <div className="mt-3 flex min-h-[52px] items-center justify-between rounded-[22px] bg-white px-4">
        <span className="text-[16px] text-kallo-text">
          {t('scan.valuesPer')}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('scan.valuesPer')}
            className="flex items-center gap-1 text-[16px] text-kallo-text outline-none"
          >
            {basisLabel(basis)}
            <ChevronsUpDown className="size-4 text-kallo-text-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48 rounded-2xl">
            {basesFor({ amount: food.basisAmount, unit: food.unit }).map(
              (b) => (
                <DropdownMenuItem
                  key={`${b.amount}-${b.unit}`}
                  onSelect={() => setBasis(b)}
                  className="gap-3 py-2.5 text-[16px]"
                >
                  <Check
                    className={
                      b.amount === basis.amount && b.unit === basis.unit
                        ? 'size-4'
                        : 'size-4 opacity-0'
                    }
                  />
                  {basisLabel(b)}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {caption(t('scan.nutrition'))}
      <div className="overflow-hidden rounded-[22px] bg-white">
        {SCAN_MACRO_DEFINITIONS.map(field)}
      </div>
      {caption(t('scan.otherNutrients'))}
      <div className="overflow-hidden rounded-[22px] bg-white">
        {SCAN_MICRONUTRIENT_DEFINITIONS.map(field)}
      </div>
      <p className="px-4 pt-2 text-[14px] text-kallo-text-muted">
        {t('scan.blankNote')}
      </p>
    </ScanPanel>
  );
}

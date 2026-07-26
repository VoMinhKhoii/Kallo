'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PortionAssumptionLine } from '@/components/logging/feed/meal-entry/portion-assumption-line';
import { PortionPickerBody } from '@/components/logging/feed/meal-entry/portion-picker-body';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { midG, VESSEL_FAMILIES } from '@/lib/ai/portion/vessel-data';
import { applyQuantityChange, applyVesselTierChange } from '@/lib/meal-utils';
import type { MealItem } from '@/lib/types/meal';

const TIERS = [1, 2, 3, 4] as const;

interface PortionPickerProps {
  item: MealItem;
  items: MealItem[];
  onApply: (items: MealItem[]) => void;
}

function isContainer(vessel: MealItem['vessel']): vessel is NonNullable<
  MealItem['vessel']
> & {
  family: 'bowl' | 'plate' | 'cup';
} {
  return (
    !!vessel &&
    (vessel.family === 'bowl' ||
      vessel.family === 'plate' ||
      vessel.family === 'cup')
  );
}

/**
 * Opens from the assumption line to adjust a dish's portion: a scaled vessel
 * image, a magnetic ruler anchored at the family's four tier weights, and a
 * live gram/kcal preview. Drawer on phones, Popover on wider screens. Edits
 * local staging state only — never a server action.
 */
export function PortionPicker({ item, items, onApply }: PortionPickerProps) {
  const { vessel } = item;
  const t = useTranslations('logging.portionPicker');
  const isMobile = useIsMobile();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [grams, setGrams] = useState(item.quantity);

  if (!isContainer(vessel)) return null;
  const { family, dishClass } = vessel;

  const anchors = TIERS.map((tier) => ({
    tier,
    value: midG(family, tier, dishClass),
    label:
      VESSEL_FAMILIES[family].tiers[tier].label[locale === 'vi' ? 'vi' : 'en'],
  }));
  const min = Math.round(anchors[0].value * 0.6);
  const max = Math.round(anchors[3].value * 1.2);

  const handleOpenChange = (next: boolean) => {
    if (next) setGrams(Math.min(max, Math.max(min, item.quantity)));
    setOpen(next);
  };

  // Settled on an anchor → tier rescale. Otherwise scale the raw grams via the
  // same proportional path the +/- stepper uses, and re-point vessel.tier to the
  // nearest anchor so the assumption line's tier label stays truthful.
  const handleApply = () => {
    const onAnchor = anchors.find((a) => a.value === grams);
    if (onAnchor) {
      onApply(applyVesselTierChange(items, item.id, onAnchor.tier));
      setOpen(false);
      return;
    }
    const nearest = anchors.reduce((best, a) =>
      Math.abs(a.value - grams) < Math.abs(best.value - grams) ? a : best
    );
    const scaled = applyQuantityChange(
      items,
      items,
      item.id,
      grams - item.quantity
    );
    onApply(
      scaled.map((it) =>
        it.id === item.id && it.vessel
          ? { ...it, vessel: { ...it.vessel, tier: nearest.tier } }
          : it
      )
    );
    setOpen(false);
  };

  const body = (
    <PortionPickerBody
      family={family}
      anchors={anchors}
      grams={grams}
      min={min}
      max={max}
      kcal={
        item.quantity > 0
          ? Math.round((item.macros.calories * grams) / item.quantity)
          : 0
      }
      onChange={setGrams}
      onApply={handleApply}
      onCancel={() => setOpen(false)}
    />
  );

  const trigger = <PortionAssumptionLine vessel={vessel} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="border-nham-border/60 bg-nham-surface">
          <DrawerTitle className="sr-only">{t('title')}</DrawerTitle>
          <div className="px-4 pt-3 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 rounded-xl border-nham-border/60 bg-card p-4 text-nham-text shadow-lg shadow-nham-text/[0.06]"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}

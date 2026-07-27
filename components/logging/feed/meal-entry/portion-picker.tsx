'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { PortionAssumptionLine } from '@/components/logging/feed/meal-entry/portion-assumption-line';
import {
  nearestAnchor,
  type PortionAnchor,
  PortionPickerBody,
} from '@/components/logging/feed/meal-entry/portion-picker-body';
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
import {
  midG,
  PIECE_TIERS,
  VESSEL_FAMILIES,
} from '@/lib/ai/portion/vessel-data';
import type { ClientVessel } from '@/lib/ai/portion/vessel-types';
import { applyQuantityChange } from '@/lib/meal-utils';
import type { MealItem } from '@/lib/types/meal';

const TIERS = [1, 2, 3, 4] as const;

interface PortionPickerProps {
  item: MealItem;
  items: MealItem[];
  onApply: (items: MealItem[]) => void;
}

/**
 * Opens from the assumption line to adjust a dish's portion: a row of
 * true-to-scale vessel thumbnails (tap to jump to a tier), a plain slider for
 * fine adjustment, and a live gram/kcal preview. Drawer on phones, Popover on
 * wider screens. Edits local staging state only — never a server action.
 */
export function PortionPicker({ item, items, onApply }: PortionPickerProps) {
  const { vessel } = item;
  const t = useTranslations('logging.portionPicker');
  const isMobile = useIsMobile();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [grams, setGrams] = useState(item.quantity);

  if (!vessel) return null;

  const loc = locale === 'vi' ? 'vi' : 'en';

  let anchors: PortionAnchor[];
  let count: number | undefined;
  let kind: 'fish' | 'meat' | undefined;
  if ('dishClass' in vessel) {
    const { family, dishClass } = vessel;
    anchors = TIERS.map((tier) => ({
      tier,
      value: midG(family, tier, dishClass),
      label: VESSEL_FAMILIES[family].tiers[tier].label[loc],
    }));
  } else {
    count = vessel.count;
    kind = vessel.kind;
    anchors = PIECE_TIERS.map((tier, index) => ({
      tier: index + 1,
      value: vessel.count * tier.grams,
      label: tier.label[loc],
    }));
  }
  const min = Math.round(anchors[0].value * 0.6);
  const max = Math.round(anchors[anchors.length - 1].value * 1.2);

  const handleOpenChange = (next: boolean) => {
    if (next) setGrams(Math.min(max, Math.max(min, item.quantity)));
    setOpen(next);
  };

  // Commit the exact previewed grams, then re-point vessel.tier to the nearest
  // anchor so the assumption line's tier label stays truthful.
  const handleApply = () => {
    const nearest = nearestAnchor(anchors, grams);
    const scaled = applyQuantityChange(
      items,
      items,
      item.id,
      grams - item.quantity
    );
    onApply(
      scaled.map((it) =>
        it.id === item.id && it.vessel
          ? {
              ...it,
              vessel: { ...it.vessel, tier: nearest.tier } as ClientVessel,
            }
          : it
      )
    );
    setOpen(false);
  };

  const body = (
    <PortionPickerBody
      family={vessel.family}
      count={count}
      kind={kind}
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

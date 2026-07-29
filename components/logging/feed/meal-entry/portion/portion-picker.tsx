'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  buildContainerAnchors,
  buildPieceAnchors,
  committedPieceTier,
  gramEnvelope,
  nearestAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { PortionAssumptionLine } from '@/components/logging/feed/meal-entry/portion/portion-assumption-line';
import { PortionPickerBody } from '@/components/logging/feed/meal-entry/portion/portion-picker-body';
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
import type { ClientVessel } from '@/lib/ai/portion/vessel-types';
import { applyQuantityChange } from '@/lib/meal-utils';
import type { MealItem } from '@/lib/types/meal';

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
  const model =
    vessel.family === 'piece'
      ? ({
          kind: 'piece',
          vessel,
          anchors: buildPieceAnchors(vessel, loc),
        } as const)
      : ({
          kind: 'container',
          vessel,
          anchors: buildContainerAnchors(vessel, loc),
        } as const);
  const { min, max } = gramEnvelope(model.anchors);

  const handleOpenChange = (next: boolean) => {
    if (next) setGrams(Math.min(max, Math.max(min, item.quantity)));
    setOpen(next);
  };

  // Commit the exact previewed grams. Containers re-point vessel.tier to the
  // nearest anchor (what they display); pieces only re-point to a tier the UI
  // actually claimed, and otherwise leave the tier untouched.
  const handleApply = () => {
    const nextVessel: ClientVessel =
      model.kind === 'piece'
        ? {
            ...model.vessel,
            tier: committedPieceTier(model.vessel.tier, model.anchors, grams),
          }
        : {
            ...model.vessel,
            tier: nearestAnchor(model.anchors, grams).tier,
          };
    const scaled = applyQuantityChange(
      items,
      items,
      item.id,
      grams - item.quantity
    );
    onApply(
      scaled.map((it) =>
        it.id === item.id ? { ...it, vessel: nextVessel } : it
      )
    );
    setOpen(false);
  };

  const body = (
    <PortionPickerBody
      vessel={vessel}
      anchors={model.anchors}
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

  const trigger = (
    <PortionAssumptionLine vessel={vessel} grams={item.quantity} />
  );

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

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type ReactElement, useState } from 'react';
import {
  buildContainerAnchors,
  buildPieceAnchors,
  committedPieceTier,
  gramEnvelope,
  nearestAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
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
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';

interface PortionPickerProps {
  vessel: ClientVessel;
  /** The dish's grams now — where the picker opens. */
  grams: number;
  /** The dish's kcal at `grams`, for the live preview. */
  kcal: number;
  /** The exact previewed grams and the vessel re-pointed to the tier they claim. */
  onApply: (grams: number, vessel: ClientVessel) => void;
  /** The control that opens it — the meal edit dialog's Size row. */
  trigger: ReactElement;
}

/**
 * Adjusts one dish's portion: a row of true-to-scale vessel thumbnails (tap to
 * jump to a tier), the ruler for fine adjustment, and a live gram/kcal
 * preview. Popover on wide screens, Drawer on phones. Edits nothing itself —
 * it hands the previewed grams back to its caller.
 */
export function PortionPicker({
  vessel,
  grams: current,
  kcal: currentKcal,
  onApply,
  trigger,
}: PortionPickerProps) {
  const t = useTranslations('logging.portionPicker');
  const isMobile = useIsMobile();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [grams, setGrams] = useState(current);

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
    if (next) setGrams(Math.min(max, Math.max(min, current)));
    setOpen(next);
  };

  // Commit the exact previewed grams. Containers re-point vessel.tier to the
  // nearest anchor (what they display); pieces only re-point to a tier the UI
  // actually claimed, and otherwise leave the tier untouched.
  const handleApply = () => {
    onApply(grams, repointVessel(model, grams));
    setOpen(false);
  };

  const body = (
    <PortionPickerBody
      vessel={vessel}
      anchors={model.anchors}
      grams={grams}
      min={min}
      max={max}
      kcal={current > 0 ? Math.round((currentKcal * grams) / current) : 0}
      onChange={setGrams}
      onApply={handleApply}
      onCancel={() => setOpen(false)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="border-kallo-border/60 bg-kallo-surface">
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
        align="end"
        sideOffset={8}
        className="w-96 rounded-xl border-kallo-border/60 bg-card p-4 text-kallo-text shadow-kallo-text/[0.06] shadow-lg"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}

type PortionModel =
  | {
      kind: 'piece';
      vessel: Extract<ClientVessel, { family: 'piece' }>;
      anchors: ReturnType<typeof buildPieceAnchors>;
    }
  | {
      kind: 'container';
      vessel: Exclude<ClientVessel, { family: 'piece' }>;
      anchors: ReturnType<typeof buildContainerAnchors>;
    };

function repointVessel(model: PortionModel, grams: number): ClientVessel {
  return model.kind === 'piece'
    ? {
        ...model.vessel,
        tier: committedPieceTier(model.vessel.tier, model.anchors, grams),
      }
    : { ...model.vessel, tier: nearestAnchor(model.anchors, grams).tier };
}

/**
 * The vessel `grams` may honestly claim, without opening the picker — for a
 * dish whose grams moved by Servings or Amount instead.
 */
export function repointVesselTo(
  vessel: ClientVessel,
  grams: number,
  locale: string
): ClientVessel {
  const loc = locale === 'vi' ? 'vi' : 'en';
  return repointVessel(
    vessel.family === 'piece'
      ? { kind: 'piece', vessel, anchors: buildPieceAnchors(vessel, loc) }
      : {
          kind: 'container',
          vessel,
          anchors: buildContainerAnchors(vessel, loc),
        },
    grams
  );
}

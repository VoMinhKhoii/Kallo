'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  buildContainerAnchors,
  buildPieceAnchors,
  committedPieceTier,
  gramEnvelope,
  nearestAnchor,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { VesselTape } from '@/components/logging/feed/meal-entry/portion/tape/vessel-tape';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';

interface PortionPickerProps {
  vessel: ClientVessel;
  /** The dish's grams now. */
  grams: number;
  /** Every move of the tape, in grams, the way Amount writes them. */
  onChange: (grams: number) => void;
}

/**
 * Adjusts one dish's portion on the vessel tape, as the iOS sheet does. It sits
 * inline under the edit dialog's Size row, whose Amount and calories above it
 * are the live readout.
 */
export function PortionPicker({ vessel, grams, onChange }: PortionPickerProps) {
  const t = useTranslations('logging.portionPicker');
  const locale = useLocale();
  const loc = locale === 'vi' ? 'vi' : 'en';
  const anchors =
    vessel.family === 'piece'
      ? buildPieceAnchors(vessel, loc)
      : buildContainerAnchors(vessel, loc);
  const { min, max } = gramEnvelope(anchors);

  return (
    <VesselTape
      vessel={vessel}
      anchors={anchors}
      grams={Math.min(max, Math.max(min, grams))}
      min={min}
      max={max}
      label={t('title')}
      onChange={onChange}
    />
  );
}

/**
 * The vessel `grams` may honestly claim. Containers name the nearest anchor;
 * pieces only move to a tier the UI actually claims, and otherwise keep theirs.
 */
export function repointVesselTo(
  vessel: ClientVessel,
  grams: number,
  locale: string
): ClientVessel {
  const loc = locale === 'vi' ? 'vi' : 'en';
  return vessel.family === 'piece'
    ? {
        ...vessel,
        tier: committedPieceTier(
          vessel.tier,
          buildPieceAnchors(vessel, loc),
          grams
        ),
      }
    : {
        ...vessel,
        tier: nearestAnchor(buildContainerAnchors(vessel, loc), grams).tier,
      };
}

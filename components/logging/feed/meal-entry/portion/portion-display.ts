import {
  buildPieceAnchors,
  claimedAnchor,
  containerReading,
  countPrefix,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import {
  PIECE_TIERS,
  VESSEL_FAMILIES,
} from '@/lib/ai/portion/data/vessel-tables';
import { pieceAssetFor } from '@/lib/ai/portion/vessel/geometry';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';

export interface PortionDisplay {
  thumb: { file: string; aspect: number };
  label: string;
}

/**
 * What a vessel at `grams` should say and show: the tier's thumbnail and its
 * label. A container names the vessel its grams sit nearest, half the first
 * one included ("½ chén nhỏ", "2 × tô vừa"). A piece portion claims a tier
 * name only within the claim band and otherwise states the honest grams.
 * Shared by the card's assumption line and the meal edit dialog's Size row,
 * so the two can never name different sizes; Flutter's `portionDisplayFor`
 * says the same.
 */
export function portionDisplay(
  vessel: ClientVessel,
  grams: number,
  loc: 'en' | 'vi'
): PortionDisplay {
  if ('dishClass' in vessel) {
    const reading = containerReading(vessel, grams, loc);
    const tier = VESSEL_FAMILIES[vessel.family].tiers[reading.tier];
    return {
      thumb: { file: tier.asset, aspect: tier.aspect },
      label: reading.label,
    };
  }
  const claimed = claimedAnchor(buildPieceAnchors(vessel, loc), grams);
  const tier = PIECE_TIERS[(claimed?.tier ?? vessel.tier) - 1];
  const prefix = vessel.count > 1 ? countPrefix(vessel.count) : '';
  const asset = pieceAssetFor(tier, vessel.kind);
  return {
    thumb: { file: asset.file, aspect: asset.aspect },
    label: claimed ? `${prefix}${claimed.label}` : `${prefix}${grams} g`,
  };
}

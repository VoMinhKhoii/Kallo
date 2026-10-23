import {
  buildPieceAnchors,
  claimedAnchor,
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
 * label. A piece portion claims a tier name only within the claim band and
 * otherwise states the honest grams. Shared by the card's assumption line and
 * the meal edit dialog's Size row, so the two can never name different sizes.
 */
export function portionDisplay(
  vessel: ClientVessel,
  grams: number,
  loc: 'en' | 'vi'
): PortionDisplay {
  if ('dishClass' in vessel) {
    const tier = VESSEL_FAMILIES[vessel.family].tiers[vessel.tier];
    return {
      thumb: { file: tier.asset, aspect: tier.aspect },
      label: tier.label[loc],
    };
  }
  const claimed = claimedAnchor(buildPieceAnchors(vessel, loc), grams);
  const tier = PIECE_TIERS[(claimed?.tier ?? vessel.tier) - 1];
  const prefix = vessel.count > 1 ? `${vessel.count} × ` : '';
  const asset = pieceAssetFor(tier, vessel.kind);
  return {
    thumb: { file: asset.file, aspect: asset.aspect },
    label: claimed ? `${prefix}${claimed.label}` : `${prefix}${grams} g`,
  };
}

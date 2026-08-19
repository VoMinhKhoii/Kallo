/** Vessel arithmetic: dimensions → grams bands, tokens → vessels, guards. */

import {
  type ContainerFamily,
  DENSITY_FILL,
  type DishClass,
  MAX_PIECE_COUNT,
  PIECE_TIERS,
  type PieceTier,
  type PieceVesselTier,
  VESSEL_FAMILIES,
  type VesselFamily,
  type VesselFamilyData,
  type VesselTier,
} from '@/lib/ai/portion/data/vessel-tables';
import type { ClientVessel, PieceVessel } from '@/lib/ai/portion/vessel/types';

export function isContainerFamily(
  family: VesselFamily
): family is ContainerFamily {
  return family === 'bowl' || family === 'plate' || family === 'cup';
}

function roundToTen(value: number): number {
  return Math.round(value / 10) * 10;
}

export function guardBandG(
  family: ContainerFamily,
  tier: VesselTier,
  dishClass: DishClass
): { low: number; high: number } {
  const ml = VESSEL_FAMILIES[family].tiers[tier].ml;
  const density = DENSITY_FILL[dishClass];
  return {
    low: roundToTen(ml * density.fillLow * density.densityLow),
    high: roundToTen(ml * density.fillHigh * density.densityHigh),
  };
}

export function midG(
  family: ContainerFamily,
  tier: VesselTier,
  dishClass: DishClass
): number {
  const ml = VESSEL_FAMILIES[family].tiers[tier].ml;
  const density = DENSITY_FILL[dishClass];
  return Math.round(ml * density.fillMid * density.densityMid);
}

/** Normalize case, whitespace, and Vietnamese diacritics for token matching. */
export function normalizeVesselToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .trim();
}

const TOKEN_LOOKUP = new Map<
  string,
  { family: ContainerFamily; defaultTier: VesselTier }
>();

for (const [family, data] of Object.entries(VESSEL_FAMILIES) as Array<
  [ContainerFamily, VesselFamilyData]
>) {
  for (const token of data.tokens) {
    const normalized = normalizeVesselToken(token);
    const defaultTier = ['chen', 'bat', 'tach'].includes(normalized) ? 1 : 2;
    TOKEN_LOOKUP.set(normalized, { family, defaultTier });
  }
}

export function resolveVesselFromToken(
  token: string,
  size?: 'small' | 'medium' | 'large'
): { family: ContainerFamily; tier: VesselTier } | null {
  const match = TOKEN_LOOKUP.get(normalizeVesselToken(token));
  if (!match) return null;

  const shift = size === 'small' ? -1 : size === 'large' ? 1 : 0;
  const tier = Math.min(4, Math.max(1, match.defaultTier + shift));
  return { family: match.family, tier: tier as VesselTier };
}

export function pieceAssetFor(
  tier: PieceTier,
  kind: PieceVessel['kind']
): PieceTier['assets'][number] {
  return tier.assets[kind === 'fish' ? 0 : kind === 'meat' ? 1 : 2];
}

/**
 * Whether a vessel is safe to hand to a client picker.
 *
 * The vessel is a DECORATION — a silhouette and a label under a dish — and it
 * must never be able to break the meal it decorates. Both clients derive an
 * envelope from it (`[0.6 x firstAnchor, 1.2 x lastAnchor]`) and clamp the
 * dish's grams into that range, so an out-of-range value does real damage
 * rather than just looking wrong:
 *
 *   - `count: -1` builds a DESCENDING envelope (min -18, max -600). Flutter's
 *     `clamp` throws on that and takes down the sheet; web's `Math.min/max`
 *     silently shows a -600 g portion.
 *   - `count: 0` renders a picker pinned at 0 g that commits 10 g (the
 *     minimum-dish floor), so the sheet promises one number and the card shows
 *     another.
 *   - `count: 1e9` clamps a normal 150 g dish up to 18 billion grams and stages
 *     it for confirmation with macros scaled by ~1.2e8.
 *   - a `tier` outside its family's range indexes past the tier table:
 *     `VESSEL_FAMILIES[family].tiers[9]` is `undefined`, and reading `.asset`
 *     off it throws while rendering the assumption line.
 *
 * Enforced HERE, in the one function every client path runs through
 * (`toParsedMeal` serves the SSE `result` frame, restored pending analyses, and
 * relog staging), so web and Flutter get the same guarantee from one place
 * instead of each re-deriving it. Clients still validate on parse — belt and
 * braces for rows written before this guard existed.
 */
export function isRenderableVessel(vessel: ClientVessel): boolean {
  if (!Number.isInteger(vessel.tier)) return false;
  if (vessel.family === 'piece') {
    return (
      vessel.tier >= 1 &&
      vessel.tier <= PIECE_TIERS.length &&
      Number.isFinite(vessel.count) &&
      vessel.count >= 1 &&
      vessel.count <= MAX_PIECE_COUNT
    );
  }
  // Bound read off the family's own tier table, like the piece branch above —
  // a hard-coded 4 goes stale the moment a family gains or loses a tier, and
  // it goes stale silently.
  const tiers = VESSEL_FAMILIES[vessel.family]?.tiers;
  return (
    !!tiers && vessel.tier >= 1 && vessel.tier <= Object.keys(tiers).length
  );
}

/**
 * Returns the closest piece tier. Exact midpoint ties choose the lower tier.
 */
export function nearestPieceTier(perPieceGrams: number): PieceVesselTier {
  let nearestIndex = 0;
  let nearestDistance = Math.abs(perPieceGrams - PIECE_TIERS[0].grams);

  for (let index = 1; index < PIECE_TIERS.length; index += 1) {
    const distance = Math.abs(perPieceGrams - PIECE_TIERS[index].grams);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }

  return (nearestIndex + 1) as PieceVesselTier;
}

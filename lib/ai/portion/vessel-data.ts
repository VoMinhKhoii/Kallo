/** Client-safe vessel dimensions and portion-envelope arithmetic. */

export type VesselFamily = 'bowl' | 'plate' | 'cup' | 'piece';

export type DishClass = 'soup' | 'solid' | 'airy' | 'drink';
export type VesselTier = 1 | 2 | 3 | 4;

interface VesselTierData {
  ml: number;
  asset: string;
  aspect: number;
  label: { vi: string; en: string };
  /** Display-only real-world size (plates: diameter, not the effective `ml`). */
  sizeLabel: string;
}

interface VesselFamilyData {
  tokens: readonly string[];
  tiers: Record<VesselTier, VesselTierData>;
}

export const VESSEL_FAMILIES: Record<
  Extract<VesselFamily, 'bowl' | 'plate' | 'cup'>,
  VesselFamilyData
> = {
  bowl: {
    tokens: ['tô', 'bát', 'chén', 'bowl'],
    tiers: {
      1: {
        ml: 400,
        asset: 'bowl-1-chen.png',
        aspect: 1.36,
        label: { vi: 'chén nhỏ', en: 'small bowl' },
        sizeLabel: '400 ml',
      },
      2: {
        ml: 700,
        asset: 'bowl-2-medium.png',
        aspect: 1.53,
        label: { vi: 'tô vừa', en: 'medium bowl' },
        sizeLabel: '700 ml',
      },
      3: {
        ml: 1000,
        asset: 'bowl-3-large-to.png',
        aspect: 1.45,
        label: { vi: 'tô lớn', en: 'large bowl' },
        sizeLabel: '1000 ml',
      },
      4: {
        ml: 1300,
        asset: 'bowl-4-pho.png',
        aspect: 2.32,
        label: { vi: 'tô rất lớn', en: 'extra-large bowl' },
        sizeLabel: '1300 ml',
      },
    },
  },
  plate: {
    tokens: ['dĩa', 'đĩa', 'plate', 'dish'],
    tiers: {
      1: {
        ml: 420,
        asset: 'plate-1-side.png',
        aspect: 2.31,
        label: { vi: 'dĩa nhỏ', en: 'side plate' },
        sizeLabel: '16 cm',
      },
      2: {
        ml: 660,
        asset: 'plate-2-coupe.png',
        aspect: 2.34,
        label: { vi: 'dĩa vừa', en: 'medium plate' },
        sizeLabel: '20 cm',
      },
      3: {
        ml: 1030,
        asset: 'plate-3-dinner.png',
        aspect: 2.1,
        label: { vi: 'dĩa lớn', en: 'dinner plate' },
        sizeLabel: '25 cm',
      },
      4: {
        ml: 1480,
        asset: 'plate-4-oval-platter.png',
        aspect: 3.22,
        label: { vi: 'dĩa đại', en: 'serving platter' },
        sizeLabel: '30 cm',
      },
    },
  },
  cup: {
    tokens: ['ly', 'cốc', 'cup', 'glass', 'mug', 'tách'],
    tiers: {
      1: {
        ml: 150,
        asset: 'cup-1-150ml.png',
        aspect: 0.9,
        label: { vi: 'ly nhỏ', en: 'small cup' },
        sizeLabel: '150 ml',
      },
      2: {
        ml: 250,
        asset: 'cup-2-250ml.png',
        aspect: 0.69,
        label: { vi: 'ly vừa', en: 'regular cup' },
        sizeLabel: '250 ml',
      },
      3: {
        ml: 500,
        asset: 'cup-3-500ml.png',
        aspect: 0.58,
        label: { vi: 'ly lớn', en: 'large cup' },
        sizeLabel: '500 ml',
      },
      4: {
        ml: 700,
        asset: 'cup-4-700ml.png',
        aspect: 0.57,
        label: { vi: 'ly rất lớn', en: 'extra-large cup' },
        sizeLabel: '700 ml',
      },
    },
  },
};

interface DensityFill {
  densityLow: number;
  densityHigh: number;
  fillLow: number;
  fillHigh: number;
  densityMid: number;
  fillMid: number;
}

function densityFill(
  densityLow: number,
  densityHigh: number,
  fillLow: number,
  fillHigh: number
): DensityFill {
  return {
    densityLow,
    densityHigh,
    fillLow,
    fillHigh,
    densityMid: (densityLow + densityHigh) / 2,
    fillMid: (fillLow + fillHigh) / 2,
  };
}

export const DENSITY_FILL: Record<DishClass, DensityFill> = {
  soup: densityFill(0.9, 1.1, 0.75, 0.95),
  solid: densityFill(0.6, 0.9, 0.6, 0.9),
  airy: densityFill(0.3, 0.6, 0.7, 1),
  drink: densityFill(0.95, 1.05, 0.85, 1),
};

export type ContainerFamily = Extract<VesselFamily, 'bowl' | 'plate' | 'cup'>;

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

export type PieceVesselTier = 1 | 2 | 3 | 4 | 5;

export interface PieceTier {
  grams: number;
  sizeLabel: string;
  label: { vi: string; en: string };
  assets: readonly [
    { file: string; aspect: number },
    { file: string; aspect: number },
  ];
}

function pieceTier(
  grams: number,
  label: PieceTier['label'],
  assets: PieceTier['assets']
): PieceTier {
  return {
    grams,
    sizeLabel: `${grams} g`,
    label,
    assets,
  };
}

export const PIECE_TIERS: readonly PieceTier[] = [
  pieceTier(30, { vi: 'miếng nhỏ', en: 'small piece' }, [
    { file: 'fish-1-chunk.png', aspect: 1.06 },
    { file: 'meat-1-cubes.png', aspect: 1.83 },
  ]),
  pieceTier(70, { vi: 'lát', en: 'slice' }, [
    { file: 'fish-2-lat.png', aspect: 2.19 },
    { file: 'meat-2-belly-slices.png', aspect: 1.28 },
  ]),
  pieceTier(150, { vi: 'miếng vừa', en: 'medium cut' }, [
    { file: 'fish-3-khoanh.png', aspect: 1.29 },
    { file: 'meat-3-chop.png', aspect: 0.82 },
  ]),
  pieceTier(250, { vi: 'phi lê', en: 'fillet' }, [
    { file: 'fish-4-portion.png', aspect: 2.17 },
    { file: 'meat-4-steak.png', aspect: 0.74 },
  ]),
  pieceTier(500, { vi: 'phần lớn', en: 'large cut' }, [
    { file: 'fish-5-large.png', aspect: 2.17 },
    { file: 'meat-5-big-steak.png', aspect: 0.72 },
  ]),
];

export function pieceAssetFor(
  tier: PieceTier,
  kind: 'fish' | 'meat'
): PieceTier['assets'][number] {
  return tier.assets[kind === 'fish' ? 0 : 1];
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

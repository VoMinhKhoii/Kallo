/** Client-safe vessel dimensions and portion-envelope arithmetic. */

export type VesselFamily =
  | 'bowl'
  | 'plate'
  | 'cup'
  | 'piece-fish'
  | 'piece-meat';

export type DishClass = 'soup' | 'solid' | 'airy' | 'drink';
export type VesselTier = 1 | 2 | 3 | 4;

interface VesselTierData {
  ml: number;
  asset: string;
  label: { vi: string; en: string };
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
        label: { vi: 'chén nhỏ', en: 'small bowl' },
      },
      2: {
        ml: 700,
        asset: 'bowl-2-medium.png',
        label: { vi: 'tô vừa', en: 'medium bowl' },
      },
      3: {
        ml: 1000,
        asset: 'bowl-3-large-to.png',
        label: { vi: 'tô lớn', en: 'large bowl' },
      },
      4: {
        ml: 1300,
        asset: 'bowl-4-pho.png',
        label: { vi: 'tô rất lớn', en: 'extra-large bowl' },
      },
    },
  },
  plate: {
    tokens: ['dĩa', 'đĩa', 'plate', 'dish'],
    tiers: {
      1: {
        ml: 420,
        asset: 'plate-1-side.png',
        label: { vi: 'dĩa nhỏ', en: 'side plate' },
      },
      2: {
        ml: 660,
        asset: 'plate-2-coupe.png',
        label: { vi: 'dĩa vừa', en: 'medium plate' },
      },
      3: {
        ml: 1030,
        asset: 'plate-3-dinner.png',
        label: { vi: 'dĩa lớn', en: 'dinner plate' },
      },
      4: {
        ml: 1480,
        asset: 'plate-4-oval-platter.png',
        label: { vi: 'dĩa đại', en: 'serving platter' },
      },
    },
  },
  cup: {
    tokens: ['ly', 'cốc', 'cup', 'glass', 'mug', 'tách'],
    tiers: {
      1: {
        ml: 150,
        asset: 'cup-1-150ml.png',
        label: { vi: 'ly nhỏ', en: 'small cup' },
      },
      2: {
        ml: 250,
        asset: 'cup-2-250ml.png',
        label: { vi: 'ly vừa', en: 'regular cup' },
      },
      3: {
        ml: 500,
        asset: 'cup-3-500ml.png',
        label: { vi: 'ly lớn', en: 'large cup' },
      },
      4: {
        ml: 700,
        asset: 'cup-4-700ml.png',
        label: { vi: 'ly rất lớn', en: 'extra-large cup' },
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

type ContainerFamily = Extract<VesselFamily, 'bowl' | 'plate' | 'cup'>;

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

interface PieceTier {
  grams: number;
  asset: string;
  displayScale: number;
}

function pieceTier(grams: number, asset: string): PieceTier {
  return {
    grams,
    asset,
    displayScale: Math.cbrt(grams) / Math.cbrt(150),
  };
}

export const PIECE_TIERS: Record<
  Extract<VesselFamily, 'piece-fish' | 'piece-meat'>,
  readonly PieceTier[]
> = {
  'piece-fish': [
    pieceTier(30, 'fish-1-chunk.png'),
    pieceTier(70, 'fish-2-small.png'),
    pieceTier(150, 'fish-3-medium.png'),
    pieceTier(250, 'fish-4-large.png'),
    pieceTier(500, 'fish-5-large.png'),
  ],
  'piece-meat': [
    pieceTier(30, 'meat-1-cubes.png'),
    pieceTier(70, 'meat-2-small.png'),
    pieceTier(150, 'meat-3-medium.png'),
    pieceTier(250, 'meat-4-steak.png'),
    pieceTier(500, 'meat-5-big-steak.png'),
  ],
};

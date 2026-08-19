/**
 * Client-safe vessel dimension tables: the physical size of every bowl /
 * plate / cup tier, the density-and-fill constants per dish class, and the
 * piece-tier art manifest. Data only — the arithmetic that reads these lives
 * in `vessel/geometry.ts`.
 */

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

export interface VesselFamilyData {
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
        asset: 'bowl-1-chen.webp',
        aspect: 1.36,
        label: { vi: 'chén nhỏ', en: 'small bowl' },
        sizeLabel: '400 ml',
      },
      2: {
        ml: 700,
        asset: 'bowl-2-medium.webp',
        aspect: 1.53,
        label: { vi: 'tô vừa', en: 'medium bowl' },
        sizeLabel: '700 ml',
      },
      3: {
        ml: 1000,
        asset: 'bowl-3-large-to.webp',
        aspect: 1.45,
        label: { vi: 'tô lớn', en: 'large bowl' },
        sizeLabel: '1000 ml',
      },
      4: {
        ml: 1300,
        asset: 'bowl-4-pho.webp',
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
        asset: 'plate-1-side.webp',
        aspect: 2.31,
        label: { vi: 'dĩa nhỏ', en: 'side plate' },
        sizeLabel: '16 cm',
      },
      2: {
        ml: 660,
        asset: 'plate-2-coupe.webp',
        aspect: 2.34,
        label: { vi: 'dĩa vừa', en: 'medium plate' },
        sizeLabel: '20 cm',
      },
      3: {
        ml: 1030,
        asset: 'plate-3-dinner.webp',
        aspect: 2.1,
        label: { vi: 'dĩa lớn', en: 'dinner plate' },
        sizeLabel: '25 cm',
      },
      4: {
        ml: 1480,
        asset: 'plate-4-oval-platter.webp',
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
        asset: 'cup-1-150ml.webp',
        aspect: 0.9,
        label: { vi: 'ly nhỏ', en: 'small cup' },
        sizeLabel: '150 ml',
      },
      2: {
        ml: 250,
        asset: 'cup-2-250ml.webp',
        aspect: 0.69,
        label: { vi: 'ly vừa', en: 'regular cup' },
        sizeLabel: '250 ml',
      },
      3: {
        ml: 500,
        asset: 'cup-3-500ml.webp',
        aspect: 0.58,
        label: { vi: 'ly lớn', en: 'large cup' },
        sizeLabel: '500 ml',
      },
      4: {
        ml: 700,
        asset: 'cup-4-700ml.webp',
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

export type PieceVesselTier = 1 | 2 | 3 | 4 | 5;

export interface PieceTier {
  grams: number;
  sizeLabel: string;
  label: { vi: string; en: string };
  assets: readonly [
    { file: string; aspect: number },
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
    { file: 'fish-1-chunk.webp', aspect: 1.06 },
    { file: 'meat-1-cubes.webp', aspect: 1.83 },
    { file: 'poultry-1-chunk.webp', aspect: 1.02 },
  ]),
  pieceTier(70, { vi: 'lát', en: 'slice' }, [
    { file: 'fish-2-lat.webp', aspect: 2.19 },
    { file: 'meat-2-belly-slices.webp', aspect: 1.28 },
    { file: 'poultry-2-wing.webp', aspect: 0.95 },
  ]),
  pieceTier(150, { vi: 'miếng vừa', en: 'medium cut' }, [
    { file: 'fish-3-khoanh.webp', aspect: 1.29 },
    { file: 'meat-3-chop.webp', aspect: 0.82 },
    { file: 'poultry-3-drumstick.webp', aspect: 0.49 },
  ]),
  pieceTier(250, { vi: 'phi lê', en: 'fillet' }, [
    { file: 'fish-4-portion.webp', aspect: 2.17 },
    { file: 'meat-4-steak.webp', aspect: 0.74 },
    { file: 'poultry-4-breast.webp', aspect: 0.58 },
  ]),
  pieceTier(500, { vi: 'phần lớn', en: 'large cut' }, [
    { file: 'fish-5-large.webp', aspect: 2.17 },
    { file: 'meat-5-big-steak.webp', aspect: 0.72 },
    { file: 'poultry-5-quarter.webp', aspect: 1.03 },
  ]),
];

/**
 * Beyond this many pieces the vessel stops being a useful affordance and is
 * almost certainly corruption or a hallucinated number. 100 of the largest cut
 * is already 60 kg of food. Mirrored by `maxPieceCount` in the Flutter app's
 * `models/vessel.dart`; the mobile asset test pins the two together.
 */
export const MAX_PIECE_COUNT = 100;

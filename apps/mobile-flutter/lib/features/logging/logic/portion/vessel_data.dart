/// Client-safe vessel dimensions and portion arithmetic.
///
/// Vendored from the web's `lib/ai/portion/vessel-data.ts` — the client slice
/// only. The token lexicon, guard bands and `resolveVesselFromToken` stay
/// server-side; the app never resolves a vessel, it only renders one the
/// pipeline already chose.
///
/// The `aspect` beside each filename is load-bearing: the picker sizes every
/// glyph from it (see `portion_anchors.dart`). A number that drifts from the
/// art on disk renders stretched, silently — `test/portion_vessel_assets_test.dart`
/// pins both.
library;

import '../../../../models/nutrition/vessel.dart';

/// Directory the silhouettes are bundled under (mirrors the web's `/portions`).
const String portionAssetDir = 'assets/portions';

class VesselAsset {
  final String file;
  final double aspect;

  const VesselAsset(this.file, this.aspect);

  /// Bundle path for `Image.asset`.
  String get path => '$portionAssetDir/$file';
}

class VesselTierData {
  final int ml;
  final VesselAsset asset;
  final String viLabel;
  final String enLabel;

  /// Display-only real-world size (plates: diameter, not the effective [ml]).
  final String sizeLabel;

  const VesselTierData({
    required this.ml,
    required this.asset,
    required this.viLabel,
    required this.enLabel,
    required this.sizeLabel,
  });

  String label(String locale) => locale == 'vi' ? viLabel : enLabel;
}

/// Four tiers per container family, keyed 1–4.
const Map<ContainerFamily, Map<int, VesselTierData>> vesselFamilies = {
  ContainerFamily.bowl: {
    1: VesselTierData(
      ml: 400,
      asset: VesselAsset('bowl-1-chen.webp', 1.36),
      viLabel: 'chén nhỏ',
      enLabel: 'small bowl',
      sizeLabel: '400 ml',
    ),
    2: VesselTierData(
      ml: 700,
      asset: VesselAsset('bowl-2-medium.webp', 1.53),
      viLabel: 'tô vừa',
      enLabel: 'medium bowl',
      sizeLabel: '700 ml',
    ),
    3: VesselTierData(
      ml: 1000,
      asset: VesselAsset('bowl-3-large-to.webp', 1.45),
      viLabel: 'tô lớn',
      enLabel: 'large bowl',
      sizeLabel: '1000 ml',
    ),
    4: VesselTierData(
      ml: 1300,
      asset: VesselAsset('bowl-4-pho.webp', 2.32),
      viLabel: 'tô rất lớn',
      enLabel: 'extra-large bowl',
      sizeLabel: '1300 ml',
    ),
  },
  ContainerFamily.plate: {
    1: VesselTierData(
      ml: 420,
      asset: VesselAsset('plate-1-side.webp', 2.31),
      viLabel: 'dĩa nhỏ',
      enLabel: 'side plate',
      sizeLabel: '16 cm',
    ),
    2: VesselTierData(
      ml: 660,
      asset: VesselAsset('plate-2-coupe.webp', 2.34),
      viLabel: 'dĩa vừa',
      enLabel: 'medium plate',
      sizeLabel: '20 cm',
    ),
    3: VesselTierData(
      ml: 1030,
      asset: VesselAsset('plate-3-dinner.webp', 2.1),
      viLabel: 'dĩa lớn',
      enLabel: 'dinner plate',
      sizeLabel: '25 cm',
    ),
    4: VesselTierData(
      ml: 1480,
      asset: VesselAsset('plate-4-oval-platter.webp', 3.22),
      viLabel: 'dĩa đại',
      enLabel: 'serving platter',
      sizeLabel: '30 cm',
    ),
  },
  ContainerFamily.cup: {
    1: VesselTierData(
      ml: 150,
      asset: VesselAsset('cup-1-150ml.webp', 0.9),
      viLabel: 'ly nhỏ',
      enLabel: 'small cup',
      sizeLabel: '150 ml',
    ),
    2: VesselTierData(
      ml: 250,
      asset: VesselAsset('cup-2-250ml.webp', 0.69),
      viLabel: 'ly vừa',
      enLabel: 'regular cup',
      sizeLabel: '250 ml',
    ),
    3: VesselTierData(
      ml: 500,
      asset: VesselAsset('cup-3-500ml.webp', 0.58),
      viLabel: 'ly lớn',
      enLabel: 'large cup',
      sizeLabel: '500 ml',
    ),
    4: VesselTierData(
      ml: 700,
      asset: VesselAsset('cup-4-700ml.webp', 0.57),
      viLabel: 'ly rất lớn',
      enLabel: 'extra-large cup',
      sizeLabel: '700 ml',
    ),
  },
};

class DensityFill {
  final double densityMid;
  final double fillMid;

  const DensityFill(
    double densityLow,
    double densityHigh,
    double fillLow,
    double fillHigh,
  ) : densityMid = (densityLow + densityHigh) / 2,
      fillMid = (fillLow + fillHigh) / 2;
}

/// Only the midpoints are used client-side; the low/high guard band that also
/// derives from these numbers is a pipeline concern.
const Map<DishClass, DensityFill> densityFill = {
  DishClass.soup: DensityFill(0.9, 1.1, 0.75, 0.95),
  DishClass.solid: DensityFill(0.6, 0.9, 0.6, 0.9),
  DishClass.airy: DensityFill(0.3, 0.6, 0.7, 1),
  DishClass.drink: DensityFill(0.95, 1.05, 0.85, 1),
};

/// Centre-of-envelope grams for a container tier — the anchor the picker shows.
int midG(ContainerFamily family, int tier, DishClass dishClass) {
  final ml = vesselFamilies[family]![tier]!.ml;
  final density = densityFill[dishClass]!;
  return (ml * density.fillMid * density.densityMid).round();
}

class PieceTier {
  final int grams;
  final String viLabel;
  final String enLabel;

  /// One asset per [PieceKind], in enum order: fish, meat, poultry.
  final List<VesselAsset> assets;

  const PieceTier({
    required this.grams,
    required this.viLabel,
    required this.enLabel,
    required this.assets,
  });

  String get sizeLabel => '$grams g';

  String label(String locale) => locale == 'vi' ? viLabel : enLabel;

  VesselAsset assetFor(PieceKind kind) => assets[kind.index];
}

/// Five tiers, index 0 = tier 1.
const List<PieceTier> pieceTiers = [
  PieceTier(
    grams: 30,
    viLabel: 'miếng nhỏ',
    enLabel: 'small piece',
    assets: [
      VesselAsset('fish-1-chunk.webp', 1.06),
      VesselAsset('meat-1-cubes.webp', 1.83),
      VesselAsset('poultry-1-chunk.webp', 1.02),
    ],
  ),
  PieceTier(
    grams: 70,
    viLabel: 'lát',
    enLabel: 'slice',
    assets: [
      VesselAsset('fish-2-lat.webp', 2.19),
      VesselAsset('meat-2-belly-slices.webp', 1.28),
      VesselAsset('poultry-2-wing.webp', 0.95),
    ],
  ),
  PieceTier(
    grams: 150,
    viLabel: 'miếng vừa',
    enLabel: 'medium cut',
    assets: [
      VesselAsset('fish-3-khoanh.webp', 1.29),
      VesselAsset('meat-3-chop.webp', 0.82),
      VesselAsset('poultry-3-drumstick.webp', 0.49),
    ],
  ),
  PieceTier(
    grams: 250,
    viLabel: 'phi lê',
    enLabel: 'fillet',
    assets: [
      VesselAsset('fish-4-portion.webp', 2.17),
      VesselAsset('meat-4-steak.webp', 0.74),
      VesselAsset('poultry-4-breast.webp', 0.58),
    ],
  ),
  PieceTier(
    grams: 500,
    viLabel: 'phần lớn',
    enLabel: 'large cut',
    assets: [
      VesselAsset('fish-5-large.webp', 2.17),
      VesselAsset('meat-5-big-steak.webp', 0.72),
      VesselAsset('poultry-5-quarter.webp', 1.03),
    ],
  ),
];

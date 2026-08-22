/// Macro-composition primitives shared by the nutrition page and the Circle
/// feed: kcal-per-gram, the chart pigments, the per-macro food glyphs, and the
/// kcal-share split both surfaces draw as one stacked bar.
///
/// The pigments are the app-wide macro trio — one set everywhere, split by hue
/// so three of them can sit touching inside a 6-10px stacked bar and stay
/// legible. See [KalloColors.macroProtein] for why the older low-chroma trio
/// was retired.
library;

import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/kallo_colors.dart';

const Map<String, double> kKcalPerGram = {
  'protein': 4,
  'carbohydrate': 4,
  'fat': 9,
};

const List<String> kCompositionKeys = ['protein', 'carbohydrate', 'fat'];

const Map<String, Color> kCompositionColors = {
  'protein': KalloColors.chartProtein,
  'carbohydrate': KalloColors.chartCarbs,
  'fat': KalloColors.chartFat,
};

/// One food per macro instead of an abstract colour swatch — beef, wheat, and a
/// drop of oil for fat, which has no single ingredient the way the other two
/// do. Same three as the web legend (keep in sync).
///
/// Fat is drawn one stroke step heavier than its neighbours, which is an
/// OPTICAL correction rather than an inconsistency: beef and wheat are dense
/// glyphs carrying several strokes each, while the droplet is a single closed
/// outline, so at a matched stroke width it reads noticeably lighter beside
/// them. Lucide's suffix is the stroke width — 300 is 1.5, 400 is 2.0 — and
/// there is no half step between, so this is the smallest nudge available.
const Map<String, IconData> kMacroIcons = {
  'protein': LucideIcons.beef300,
  'carbohydrate': LucideIcons.wheat300,
  'fat': LucideIcons.droplet400,
};

class CompositionSegment {
  final String key;
  final double pct;
  const CompositionSegment({required this.key, required this.pct});
}

class Composition {
  final double totalKcal;
  final List<CompositionSegment> segments;
  const Composition({required this.totalKcal, required this.segments});
}

/// Splits already-computed per-macro calories into percentage segments.
Composition compositionFromKcal(Map<String, double> kcalByKey) {
  final total = kCompositionKeys.fold<double>(
    0,
    (sum, key) => sum + (kcalByKey[key] ?? 0),
  );
  return Composition(
    totalKcal: total,
    segments: [
      for (final key in kCompositionKeys)
        CompositionSegment(
          key: key,
          pct: total > 0 ? ((kcalByKey[key] ?? 0) / total) * 100 : 0,
        ),
    ],
  );
}

/// Composition for a single meal's macro grams.
///
/// The split is by CALORIE share, not gram weight: fat carries 9 kcal/g, so by
/// weight it reads about half the slice its energy earns. A null macro counts
/// as zero rather than collapsing the bar — a meal missing one figure still
/// shows the shape of the two it has.
Composition compositionFromGrams({
  required double? protein,
  required double? carbohydrate,
  required double? fat,
}) {
  final grams = <String, double?>{
    'protein': protein,
    'carbohydrate': carbohydrate,
    'fat': fat,
  };
  return compositionFromKcal({
    for (final key in kCompositionKeys)
      key: (grams[key] ?? 0) * kKcalPerGram[key]!,
  });
}

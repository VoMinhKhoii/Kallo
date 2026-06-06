/// Pure daily-rhythm helpers vendored from web `components/nutrition/sections/
/// daily-rhythm.tsx` (keep in sync). `kCompositionColors` swaps the web's
/// `var(--nham-macro-*)` for resolved mobile tokens.
///
/// Ported from `apps/mobile/src/lib/nutrition/logic/rhythm-logic.ts`.
library;

import 'dart:ui';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';

const Map<String, double> kKcalPerGram = {
  'protein': 4,
  'carbohydrate': 4,
  'fat': 9,
};

const List<String> kCompositionKeys = ['protein', 'carbohydrate', 'fat'];

const Map<String, Color> kCompositionColors = {
  'protein': NhamColors.macroProtein,
  'carbohydrate': NhamColors.macroCarbs,
  'fat': NhamColors.macroFat,
};

const Map<String, String> kCompositionShort = {
  'protein': 'P',
  'carbohydrate': 'C',
  'fat': 'F',
};

const List<String> kOrderedMacros = ['protein', 'carbohydrate', 'fat', 'fiber'];

String consistencyLabelKey(double? pct) {
  if (pct == null) return 'rhythm.consistency.noTarget';
  if (pct >= 80) return 'rhythm.consistency.steady';
  if (pct >= 55) return 'rhythm.consistency.rhythmic';
  if (pct >= 30) return 'rhythm.consistency.varies';
  return 'rhythm.consistency.thin';
}

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

/// Builds the macro composition (kcal-share) segments for the calorie pill.
Composition buildComposition(List<MacroPattern> macros) {
  final composition = kCompositionKeys.map((key) {
    final macro = macros.where((m) => m.key == key).firstOrNull;
    if (macro == null || macro.averagePerDay <= 0) {
      return (key: key, kcal: 0.0);
    }
    return (key: key, kcal: macro.averagePerDay * kKcalPerGram[key]!);
  }).toList();
  final totalKcal = composition.fold<double>(0, (sum, c) => sum + c.kcal);
  final segments = composition
      .map((c) => CompositionSegment(
            key: c.key,
            pct: totalKcal > 0 ? (c.kcal / totalKcal) * 100 : 0,
          ))
      .toList();
  return Composition(totalKcal: totalKcal, segments: segments);
}

/// The macro rows shown under the calorie pill, in the web's fixed order.
List<MacroPattern> orderedMacroRows(List<MacroPattern> macros) {
  return kOrderedMacros
      .map((key) => macros.where((m) => m.key == key).firstOrNull)
      .whereType<MacroPattern>()
      .toList();
}

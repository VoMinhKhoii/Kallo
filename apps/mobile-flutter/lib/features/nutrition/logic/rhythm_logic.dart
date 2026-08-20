/// Pure daily-rhythm helpers. The composition primitives now live in
/// `shared/logic/macro_composition.dart` and are re-exported here so existing
/// call sites keep reading; the web side is `COMPOSITION_COLORS` in
/// `components/nutrition/sections/macro-trend-utils.ts` (keep in sync).
///
/// The `daily-rhythm.tsx` section the rest of this was vendored from was
/// removed in the web nutrition rewrite (commit cdd7a3fa); parity of the
/// remaining helpers has not been re-verified since.
library;

import '../../../models/nutrition/nutrition.dart';
import '../../../shared/logic/macro_composition.dart';

export '../../../shared/logic/macro_composition.dart';


const List<String> kOrderedMacros = ['protein', 'carbohydrate', 'fat', 'fiber'];

String consistencyLabelKey(double? pct) {
  if (pct == null) return 'rhythm.consistency.noTarget';
  if (pct >= 80) return 'rhythm.consistency.steady';
  if (pct >= 55) return 'rhythm.consistency.rhythmic';
  if (pct >= 30) return 'rhythm.consistency.varies';
  return 'rhythm.consistency.thin';
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

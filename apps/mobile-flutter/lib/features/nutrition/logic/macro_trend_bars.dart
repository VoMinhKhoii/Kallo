/// Turns the overview `daySeries` into stacked macro-calorie bars. Mirror of
/// web `buildMacroTrendData` in
/// `components/nutrition/sections/macro-trend-utils.ts` (keep in sync).
library;

import '../../../models/nutrition.dart';
import 'rhythm_logic.dart';

class MacroBar {
  const MacroBar({
    required this.index,
    required this.startDate,
    required this.endDate,
    required this.protein,
    required this.carbohydrate,
    required this.fat,
    this.excluded = false,
  });

  final int index;
  final String startDate;
  final String endDate;

  /// kcal from each macro, or null on all three when the bucket has no days.
  final double? protein;
  final double? carbohydrate;
  final double? fat;

  /// Logged, but set aside by the current day scope — drawn grey, not dropped.
  final bool excluded;

  /// Nothing logged in the bucket — draw nothing, but hold the slot.
  bool get isGap => protein == null && carbohydrate == null && fat == null;

  double get proteinKcal => protein ?? 0;
  double get carbsKcal => carbohydrate ?? 0;
  double get fatKcal => fat ?? 0;
  double get total => proteinKcal + carbsKcal + fatKcal;
}

/// Whether a column is drawn in the muted pigment rather than its macro colours.
///
/// Grey means one thing at a time, because the chart is in one of two modes:
///
///   nothing selected  — grey is "this scope does not count it" (`excluded`)
///   something selected — grey is "this is not the one you picked"
///
/// A selection therefore OVERRIDES exclusion for the column it lands on.
/// Without that, tapping a set-aside column greyed the whole chart — that
/// column for being excluded and every other one for not being selected —
/// leaving no colour anywhere and no way to see what had been picked. Mirror of
/// the web `isColumnDimmed` (keep in sync).
bool isColumnDimmed(MacroBar bar, int? selectedIndex) {
  if (selectedIndex != null) return selectedIndex != bar.index;
  return bar.excluded;
}

class MacroTrendBars {
  const MacroTrendBars({required this.bars, required this.maxY});

  final List<MacroBar> bars;
  final double maxY;
}

/// Null when there is no trend to chart — fewer than two buckets, or no
/// calories anywhere — so the caller keeps the static composition bar.
MacroTrendBars? buildMacroTrendBars(NutritionDaySeries daySeries) {
  NutrientDaySeries? seriesFor(String metric) =>
      daySeries.series.where((s) => s.metric == metric).firstOrNull;

  final p = seriesFor('protein');
  final c = seriesFor('carbohydrate');
  final f = seriesFor('fat');

  // All macros share the same bucket axis; fall back to whichever exists.
  final buckets = (p ?? c ?? f)?.buckets ?? const <DaySeriesBucket>[];
  if (buckets.length < 2) return null;

  double? raw(NutrientDaySeries? s, int i) =>
      s != null && i < s.buckets.length ? s.buckets[i].value : null;

  var maxY = 0.0;
  final bars = <MacroBar>[];
  for (var i = 0; i < buckets.length; i++) {
    final rp = raw(p, i);
    final rc = raw(c, i);
    final rf = raw(f, i);

    // Null on all three = nothing was logged in the bucket at all. That is "no
    // data", not "ate nothing": no stack bands, and it must not pull `maxY`.
    // (A bucket the day scope sets aside keeps its value and is flagged
    // `excluded` instead, so it still draws — greyed.)
    if (rp == null && rc == null && rf == null) {
      bars.add(MacroBar(
        index: i,
        startDate: buckets[i].startDate,
        endDate: buckets[i].endDate,
        protein: null,
        carbohydrate: null,
        fat: null,
      ));
      continue;
    }

    // A null on only SOME macros inside a bucket that does have days is a
    // genuine zero for that macro.
    final bar = MacroBar(
      index: i,
      startDate: buckets[i].startDate,
      endDate: buckets[i].endDate,
      protein: (rp ?? 0) * kKcalPerGram['protein']!,
      carbohydrate: (rc ?? 0) * kKcalPerGram['carbohydrate']!,
      fat: (rf ?? 0) * kKcalPerGram['fat']!,
      excluded: buckets[i].excluded,
    );
    if (bar.total > maxY) maxY = bar.total;
    bars.add(bar);
  }

  if (maxY <= 0) return null;
  return MacroTrendBars(bars: bars, maxY: maxY);
}

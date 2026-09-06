import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../models/nutrition/nutrition.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../logic/rhythm_logic.dart';
import 'calorie_scope_stats.dart';
import '../charts/macro_trend_chart.dart';

/// The calorie card at the top of the nutrition view: the hero average over
/// the active day scope, a switch naming the OTHER scope, the dates the figure
/// covers, and the stacked macro-calorie chart under them.
///
/// The gram legend that used to close the card now lives in the macro rows
/// below it (`MacroRowsCard`) — the chart's own pigments are the colour key,
/// and each macro reads better as a row with its target than as a third
/// wrapped item repeating the same three names.
class DaySummary extends StatelessWidget {
  const DaySummary({
    super.key,
    required this.macros,
    required this.resolvedRange,
    required this.daySeries,
    required this.calorieAverages,
    required this.previousCalorieAverages,
    required this.scope,
    required this.onScopeChange,
    required this.dateSpan,
    required this.todayIndex,
    required this.selectedIndex,
    required this.onSelect,
    required this.isEmpty,
  });

  final List<MacroPattern> macros;
  final String resolvedRange;
  final NutritionDaySeries daySeries;
  final CalorieAverages calorieAverages;

  /// The same averages for the equal-length window before this one.
  final CalorieAverages previousCalorieAverages;
  final NutritionDayScope scope;
  final ValueChanged<NutritionDayScope> onScopeChange;

  /// The dates the figures cover — the range, or the tapped bucket.
  final String dateSpan;
  final int todayIndex;
  final int? selectedIndex;
  final ValueChanged<int> onSelect;

  /// Nothing logged in the range: one figure, no scope swap to choose between.
  final bool isEmpty;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final composition = buildComposition(macros);

    final activeAvg = calorieAverages.forScope(scope).averagePerDay;

    // For multi-day ranges with ≥2 buckets, show the macro-calorie trend chart;
    // a single day has no trend, so it keeps the composition bar.
    final macroSeries = daySeries.series
        .where((s) =>
            s.metric == 'protein' ||
            s.metric == 'carbohydrate' ||
            s.metric == 'fat')
        .toList();
    final bucketCount =
        macroSeries.isEmpty ? 0 : macroSeries.first.buckets.length;
    final showTrend = resolvedRange != '1d' && bucketCount >= 2;

    return Container(
      // 16 horizontal / 12 vertical — the app-wide card inset where the card
      // opens and closes on text. No shadow: on the native canvas a white card
      // separates by surface alone.
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp4,
        vertical: KalloSpacing.sp3,
      ),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CalorieScopeStats(
            averages: calorieAverages,
            scope: scope,
            locale: locale,
            onScopeChange: onScopeChange,
            dateSpan: dateSpan,
            selectedValue: selectedIndex == null
                ? null
                : (macros
                        .where((m) => m.key == 'calories')
                        .firstOrNull
                        ?.averagePerDay ??
                    0),
            hasSelection: selectedIndex != null,
            isEmpty: isEmpty,
            // How this window compares with the one before it, same length and
            // same day scope. Absent while a column is selected — one bucket
            // has no "period before" of its own — and absent when nothing was
            // logged back then.
            diff: selectedIndex == null &&
                    activeAvg != null &&
                    previousCalorieAverages.forScope(scope).averagePerDay !=
                        null
                ? activeAvg -
                    previousCalorieAverages.forScope(scope).averagePerDay!
                : null,
          ),
          if (composition.totalKcal > 0) ...[
            const SizedBox(height: KalloSpacing.sp3),
            if (showTrend)
              MacroTrendChart(
                daySeries: daySeries,
                todayIndex: todayIndex,
                selectedIndex: selectedIndex,
                onSelect: onSelect,
              )
            else
              CompositionBar(segments: composition.segments),
          ],
          // The complete-day rule, said once where the filtered figure lives.
          // Ported from the web card (`components/nutrition/sections/
          // day-summary.tsx`), which shows it on the COMPLETE scope only and
          // hides it — rather than swapping the copy — everywhere else: on All
          // nothing is being set aside, so the note would explain a rule the
          // card is not applying, and with a column selected the figure is one
          // bucket rather than an average over a scope at all.
          if (scope == NutritionDayScope.complete &&
              selectedIndex == null &&
              !isEmpty) ...[
            const SizedBox(height: KalloSpacing.sp4),
            const Divider(height: 1, thickness: 1, color: kHairline),
            const SizedBox(height: KalloSpacing.sp3),
            Text(
              tr(
                'nutrition.rhythm.completeDaysHint',
                namedArgs: {'allLabel': tr('nutrition.rhythm.loggedDays')},
              ),
              style: dashMeta(),
            ),
          ],
        ],
      ),
    );
  }
}

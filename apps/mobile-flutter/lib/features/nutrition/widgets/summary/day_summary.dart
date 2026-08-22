import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../models/nutrition/nutrition.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/helpers.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../logic/rhythm_logic.dart';
import 'calorie_scope_stats.dart';
import '../charts/macro_trend_chart.dart';

/// Compact calorie + macro summary at the top of the nutrition view. The hero
/// calorie figure is the average over the active day scope; the other scope's
/// average sits beneath it as a subtle, tappable secondary. Tapping swaps the
/// two (with the whole card re-scoping underneath). A P/C/F bar chart + gram
/// legend sits below.
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
      padding: const EdgeInsets.all(KalloSpacing.sp5),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: kCardShadows,
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
            const SizedBox(height: KalloSpacing.sp3),
            // Colour key: which band is which macro (+ avg grams).
            //
            // `spaceEvenly` with a small MINIMUM gap, rather than centring on a
            // fixed one. The three items are different widths in both locales
            // and much wider in Vietnamese ("Chất béo" against "Fat"), so a
            // fixed gap either wraps the last one onto its own line or leaves
            // the row lopsided. Distributing the slack keeps the gaps equal at
            // any label width, and Wrap still breaks rather than overflowing if
            // the text scale is turned up.
            SizedBox(
              width: double.infinity,
              child: Wrap(
                alignment: WrapAlignment.spaceEvenly,
                spacing: KalloSpacing.sp2,
                runSpacing: KalloSpacing.sp1,
                children: [
                  for (final key in kCompositionKeys)
                    _MacroLegend(
                      // The legend's own short names, not `macros.<key>`: these
                      // sit beside a number in a tight row, so they are clipped
                      // harder than the full names the nutrient grid uses.
                      label: tr('nutrition.macrosShort.$key'),
                      grams: macros.where((m) => m.key == key).firstOrNull,
                      color: kCompositionColors[key]!,
                      icon: kMacroIcons[key]!,
                      locale: locale,
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 8px rounded P/C/F kcal-share bar (static — the cells fill on the grid below).
class _MacroLegend extends StatelessWidget {
  const _MacroLegend({
    required this.label,
    required this.grams,
    required this.color,
    required this.icon,
    required this.locale,
  });

  final String label;
  final MacroPattern? grams;
  final Color color;
  final IconData icon;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final m = grams;
    final value =
        m == null ? '—' : '${formatLocalizedNumber(m.averagePerDay, locale)}g';

    // No ±% against target here. Three of them pushed the row onto two lines
    // with the last item stranded and centred, and the nutrient grid below
    // already reports every macro against its target properly.
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // The icon carries the band's colour, so it is the colour key as well
        // as the name — no swatch to decode beside it.
        Icon(icon, size: 14, color: color),
        const SizedBox(width: KalloSpacing.sp1_5),
        Text('$label $value', style: dashMeta(tabular: true)),
      ],
    );
  }
}

/// Top-right calorie-goal chip: an over/under arrow + the target calories.

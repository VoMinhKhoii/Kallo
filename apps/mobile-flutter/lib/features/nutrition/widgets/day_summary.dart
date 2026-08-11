import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_theme.dart';
import '../logic/helpers.dart';
import '../logic/rhythm_logic.dart';
import 'calorie_scope_stats.dart';
import 'macro_trend_chart.dart';

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
      padding: const EdgeInsets.all(NhamSpacing.sp5),
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
            const SizedBox(height: NhamSpacing.sp3),
            if (showTrend)
              MacroTrendChart(
                daySeries: daySeries,
                todayIndex: todayIndex,
                selectedIndex: selectedIndex,
                onSelect: onSelect,
              )
            else
              _CompositionBar(segments: composition.segments),
            const SizedBox(height: NhamSpacing.sp3),
            // Centered color key: which band is which macro (+ avg grams).
            SizedBox(
              width: double.infinity,
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: NhamSpacing.sp4,
                runSpacing: NhamSpacing.sp1,
                children: [
                  for (final key in kCompositionKeys)
                    _MacroLegend(
                      label: kCompositionShort[key]!,
                      grams: macros.where((m) => m.key == key).firstOrNull,
                      color: kCompositionColors[key]!,
                      icon: _macroIcons[key]!,
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
class _CompositionBar extends StatelessWidget {
  const _CompositionBar({required this.segments});

  final List<CompositionSegment> segments;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(NhamRadii.pill),
      child: SizedBox(
        height: 8,
        child: Row(
          children: [
            for (final segment in segments)
              if (segment.pct > 0)
                Expanded(
                  flex: (segment.pct * 1000).round(),
                  child: ColoredBox(color: kCompositionColors[segment.key]!),
                ),
          ],
        ),
      ),
    );
  }
}

/// One food per macro instead of an abstract colour swatch — beef, wheat, and a
/// drop of oil for fat, which has no single ingredient the way the other two
/// do. Same three as the web legend (keep in sync).
const Map<String, IconData> _macroIcons = {
  'protein': LucideIcons.beef300,
  'carbohydrate': LucideIcons.wheat300,
  'fat': LucideIcons.droplet300,
};

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
        const SizedBox(width: NhamSpacing.sp1_5),
        Text('$label $value', style: dashMeta(tabular: true)),
      ],
    );
  }
}

/// Top-right calorie-goal chip: an over/under arrow + the target calories.

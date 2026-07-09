import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_theme.dart';
import '../logic/helpers.dart';
import '../logic/rhythm_logic.dart';
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
    required this.scope,
    required this.onScopeChange,
  });

  final List<MacroPattern> macros;
  final String resolvedRange;
  final NutritionDaySeries daySeries;
  final CalorieAverages calorieAverages;
  final NutritionDayScope scope;
  final ValueChanged<NutritionDayScope> onScopeChange;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final calories = macros.where((m) => m.key == 'calories').firstOrNull;
    final composition = buildComposition(macros);

    // The active scope has no qualifying days (only reachable for 'complete'):
    // the hero shows "—" and a hint, and the body/chart are absent.
    final activeAvg = calorieAverages.forScope(scope).averagePerDay;
    final isEmptyComplete =
        scope == NutritionDayScope.complete && activeAvg == null;
    final target = calories?.target;

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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _CalorieSwap(
                  averages: calorieAverages,
                  scope: scope,
                  locale: locale,
                  onScopeChange: onScopeChange,
                ),
              ),
              // Top-right: over/under vs the calorie goal for the active average.
              // Hidden when no goal is set or the active scope has no average.
              if (target != null && target > 0 && activeAvg != null)
                _CalorieTarget(
                  avg: activeAvg,
                  target: target,
                  locale: locale,
                ),
            ],
          ),
          if (isEmptyComplete) ...[
            const SizedBox(height: NhamSpacing.sp3),
            Text(
              tr('nutrition.rhythm.noCompleteDays'),
              style: dashMeta(color: kInkMuted),
            ),
          ],
          if (composition.totalKcal > 0) ...[
            const SizedBox(height: NhamSpacing.sp3),
            if (showTrend)
              MacroTrendChart(daySeries: daySeries)
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

/// The two calorie averages (complete + all) stacked as a hero + subtle
/// secondary. On [scope] change the parent rebuilds and the two entries glide
/// between the hero and sub slots (position) while morphing size/colour —
/// a buttery "switch places". The inactive (sub) entry is tappable to promote it.
class _CalorieSwap extends StatelessWidget {
  const _CalorieSwap({
    required this.averages,
    required this.scope,
    required this.locale,
    required this.onScopeChange,
  });

  final CalorieAverages averages;
  final NutritionDayScope scope;
  final String locale;
  final ValueChanged<NutritionDayScope> onScopeChange;

  static const Duration _dur = Duration(milliseconds: 320);
  static const Curve _curve = Curves.easeOutCubic;
  static const double _heroTop = 0;
  static const double _subTop = 62;

  void _select(NutritionDayScope next) {
    HapticFeedback.selectionClick();
    onScopeChange(next);
  }

  @override
  Widget build(BuildContext context) {
    final completeActive = scope == NutritionDayScope.complete;
    return SizedBox(
      height: 100,
      child: Stack(
        children: [
          _entry(
            data: averages.complete,
            labelKey: 'nutrition.rhythm.avgPerCompleteDay',
            active: completeActive,
            onPromote: () => _select(NutritionDayScope.complete),
          ),
          _entry(
            data: averages.all,
            labelKey: 'nutrition.rhythm.avgPerLoggedDay',
            active: !completeActive,
            onPromote: () => _select(NutritionDayScope.all),
          ),
        ],
      ),
    );
  }

  Widget _entry({
    required CalorieScopeAverage data,
    required String labelKey,
    required bool active,
    required VoidCallback onPromote,
  }) {
    final numberStyle = active
        ? dashHero()
        : dashHero(color: kInkMuted).copyWith(
            fontSize: 20,
            letterSpacing: -0.5,
          );
    final valueText = data.averagePerDay != null
        ? formatLocalizedNumber(data.averagePerDay!, locale)
        : '—';
    final label =
        '${tr(labelKey)} · ${data.days} ${tr('nutrition.rhythm.days')}';

    return AnimatedPositioned(
      duration: _dur,
      curve: _curve,
      top: active ? _heroTop : _subTop,
      left: 0,
      right: 0,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: active ? null : onPromote,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: _dur,
                  curve: _curve,
                  style: numberStyle,
                  child: Text(valueText),
                ),
                const SizedBox(width: NhamSpacing.sp2),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    tr('nutrition.rhythm.calories'),
                    style: dashMeta(color: kInkMuted),
                  ),
                ),
                if (!active) ...[
                  const SizedBox(width: NhamSpacing.sp1),
                  const Icon(
                    LucideIcons.arrowUpDown,
                    size: 12,
                    color: kInkMuted,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 2),
            Text(label, style: dashEyebrow(color: kInkMuted)),
          ],
        ),
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

class _MacroLegend extends StatelessWidget {
  const _MacroLegend({
    required this.label,
    required this.grams,
    required this.color,
    required this.locale,
  });

  final String label;
  final MacroPattern? grams;
  final Color color;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final m = grams;
    final value =
        m == null ? '—' : '${formatLocalizedNumber(m.averagePerDay, locale)}g';

    // Deviation from this macro's target (+over / −under), shown with an arrow.
    int? dev;
    if (m?.target != null && m!.target! > 0) {
      dev = (m.averagePerDay / m.target! * 100 - 100).round();
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Longer rounded swatch (a short bar, not a tiny dot).
        Container(
          width: 16,
          height: 6,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp1_5),
        Text('$label $value', style: dashMeta(tabular: true)),
        if (dev != null) ...[
          const SizedBox(width: NhamSpacing.sp1),
          Icon(
            dev >= 0 ? LucideIcons.arrowUp : LucideIcons.arrowDown,
            size: 12,
            color: kInkMuted,
          ),
          Text(
            '${dev.abs()}%',
            style: dashMeta(color: kInkMuted, tabular: true),
          ),
        ],
      ],
    );
  }
}

/// Top-right calorie-goal chip: an over/under arrow + the target calories.
class _CalorieTarget extends StatelessWidget {
  const _CalorieTarget({
    required this.avg,
    required this.target,
    required this.locale,
  });

  final double avg;
  final double target;
  final String locale;

  @override
  Widget build(BuildContext context) {
    // Signed gap between the average and the goal — the arrow shows direction,
    // the number shows how many calories over/under the target we are.
    final diff = avg - target;
    final over = diff >= 0;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            over ? LucideIcons.arrowUp : LucideIcons.arrowDown,
            size: 15,
            color: kInkMuted,
          ),
          const SizedBox(width: 2),
          Text(
            '${formatLocalizedNumber(diff.abs(), locale)} ${tr('nutrition.rhythm.calories')}',
            style: dashMeta(color: kInkMuted, tabular: true),
          ),
        ],
      ),
    );
  }
}

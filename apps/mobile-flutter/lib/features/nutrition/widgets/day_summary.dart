import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_theme.dart';
import '../logic/helpers.dart';
import '../logic/rhythm_logic.dart';
import 'macro_trend_chart.dart';

/// Compact calorie + macro summary at the top of the nutrition view — the lean
/// replacement for the tall "daily rhythm" card. The calorie figure is the one
/// serif (Lora) moment per viewport; everything else is the dashboard sans
/// scale. A thin P/C/F composition bar + gram legend sits underneath.
class DaySummary extends StatelessWidget {
  const DaySummary({
    super.key,
    required this.macros,
    required this.resolvedRange,
    required this.daySeries,
  });

  final List<MacroPattern> macros;
  final String resolvedRange;
  final NutritionDaySeries daySeries;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final calories = macros.where((m) => m.key == 'calories').firstOrNull;
    final composition = buildComposition(macros);

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
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      calories != null
                          ? formatLocalizedNumber(calories.averagePerDay, locale)
                          : '—',
                      style: dashHero(),
                    ),
                    const SizedBox(width: NhamSpacing.sp2),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(
                        tr('nutrition.rhythm.calories'),
                        style: dashMeta(color: kInkMuted),
                      ),
                    ),
                  ],
                ),
              ),
              // Top-right: target calories with an over/under arrow. Empty when
              // no calorie goal is set.
              if (calories?.target != null && calories!.target! > 0)
                _CalorieTarget(
                  avg: calories.averagePerDay,
                  target: calories.target!,
                  locale: locale,
                ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp3),
          Text(
            tr('nutrition.rhythm.avgPerLoggedDay').toUpperCase(),
            style: dashEyebrow(color: kInkMuted),
          ),
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
    final over = avg >= target;
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
            '${formatLocalizedNumber(target, locale)} ${tr('nutrition.rhythm.calories')}',
            style: dashMeta(color: kInkMuted, tabular: true),
          ),
        ],
      ),
    );
  }
}

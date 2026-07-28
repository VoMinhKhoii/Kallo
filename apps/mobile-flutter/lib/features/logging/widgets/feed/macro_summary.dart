import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../../data/logging_models.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../calorie_ring.dart';
import '../entrances.dart';
import 'loading_skeletons.dart';
import 'macro_bar.dart';

/// The feed's header: the calorie ring plus one bar per macro.
///
/// Enters opacity + slide-down (350ms). While the day query loads, the live
/// ring/bars are replaced by a 2-col skeleton.
class MacroSummary extends StatelessWidget {
  const MacroSummary({super.key, required this.view, required this.profile});

  final FeedViewState view;
  final LoggingProfile profile;

  @override
  Widget build(BuildContext context) {
    final macroBars = [
      _MacroBarData(
        'dashboard.protein'.tr(),
        view.dailyProtein,
        profile.proteinTargetG,
        NhamColors.macroProtein,
      ),
      _MacroBarData(
        'dashboard.carbs'.tr(),
        view.dailyCarbs,
        profile.carbsTargetG,
        NhamColors.macroCarbs,
      ),
      _MacroBarData(
        'dashboard.fat'.tr(),
        view.dailyFat,
        profile.fatTargetG,
        NhamColors.macroFat,
      ),
    ];

    return FadeInUp(
      child: Container(
        color: NhamColors.surface,
        padding: const EdgeInsets.fromLTRB(
          NhamSpacing.sp3,
          LoggingSpacing.block,
          NhamSpacing.sp3,
          LoggingSpacing.block,
        ),
        child:
            view.isLoading
                ? const MacroSummarySkeleton()
                : view.hasUnknownDailyMacros
                // Some legacy meals have unknown macros — the day can't be
                // totalled, so say so plainly instead of showing a wrong ring.
                ? Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'logging.feedArea.legacyMacroWarning'.tr(),
                    style: dashMeta(),
                  ),
                )
                : Row(
                  children: [
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CalorieRing(
                          current: view.dailyCalories.toDouble(),
                          target: profile.calorieTarget.toDouble(),
                        ),
                        const SizedBox(height: 4), // gap-1
                        Text(
                          '${formatCount(view.dailyCalories, context.locale.toString())} / ${formatCount(profile.calorieTarget, context.locale.toString())} kcal', style: dashMeta(tabular: true),),
                      ],
                    ),
                    const SizedBox(width: NhamSpacing.sp4), // gap-4
                    Expanded(
                      child: Column(
                        children: [
                          for (var i = 0; i < macroBars.length; i++) ...[
                            _MacroRow(data: macroBars[i]),
                            if (i != macroBars.length - 1)
                              const SizedBox(height: NhamSpacing.sp2), // gap-2
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
      ),
    );
  }
}

class _MacroBarData {
  const _MacroBarData(this.label, this.current, this.target, this.color);
  final String label;
  final int current;
  final int target;
  final Color color;
}

class _MacroRow extends StatelessWidget {
  const _MacroRow({required this.data});
  final _MacroBarData data;

  @override
  Widget build(BuildContext context) {
    final pct =
        data.target > 0
            ? math
                .max(0, math.min(100, (data.current / data.target) * 100))
                .toDouble()
            : 0.0;
    return Row(
      children: [
        SizedBox(
          width: 76,
          child: Text(
            data.label,
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.clip,
            style: dashMeta(),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3), // gap-3
        Expanded(child: MacroBar(pct: pct, color: data.color)),
        const SizedBox(width: NhamSpacing.sp3),
        SizedBox(
          width: 56, // w-14
          child: Text(
            '${data.current}/${data.target}g', style: dashMeta(tabular: true),),
        ),
      ],
    );
  }
}

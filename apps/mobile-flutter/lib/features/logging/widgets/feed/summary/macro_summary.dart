/// The feed's header: the day's calorie dial and the three macro dials beside
/// it.
///
/// Ported from the dashboard dock's 240° gauge, in its embedded size. The dock
/// gives the dial the top of the screen; this header sits FIXED above a
/// scrolling day, so it draws the compact variants — the same marks, the same
/// goal-aware readout, at a height the feed can afford.
///
/// Enters opacity + slide-down (350ms). While the day query loads, the live
/// dials are replaced by a skeleton of the same silhouette.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../shared/widgets/gauge/calorie_dial.dart';
import '../../../../../shared/widgets/gauge/macro_dial_row.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../data/logging_models.dart';
import '../../../logic/feed/view_state.dart';
import '../../../logic/logging_spacing.dart';
import '../../composer/entrances.dart';
import '../placeholder/loading_skeletons.dart';

class MacroSummary extends StatelessWidget {
  const MacroSummary({super.key, required this.view, required this.profile});

  final FeedViewState view;
  final LoggingProfile profile;

  @override
  Widget build(BuildContext context) {
    return FadeInUp(
      child: Container(
        color: KalloColors.surface,
        padding: const EdgeInsets.fromLTRB(
          KalloSpacing.sp3,
          LoggingSpacing.block,
          KalloSpacing.sp3,
          LoggingSpacing.block,
        ),
        child:
            view.isLoading
                ? const MacroSummarySkeleton()
                : view.hasUnknownDailyMacros
                // Some legacy meals have unknown macros — the day can't be
                // totalled, so say so plainly instead of showing wrong dials.
                ? Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'logging.feedArea.legacyMacroWarning'.tr(),
                    style: dashMeta(),
                  ),
                )
                : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CalorieDial.compact(
                      logged: view.dailyCalories.toDouble(),
                      target: profile.calorieTarget.toDouble(),
                      goal: profile.goal,
                    ),
                    // The calorie dial is the widest single mark in the row and
                    // sizes itself; everything left over goes to the three
                    // macros, which shrink to fit rather than overflow.
                    const SizedBox(width: KalloSpacing.sp3),
                    Expanded(
                      child: MacroDialRow.compact(
                        current: {
                          'protein': view.dailyProtein,
                          'carbohydrate': view.dailyCarbs,
                          'fat': view.dailyFat,
                        },
                        target: {
                          'protein': profile.proteinTargetG,
                          'carbohydrate': profile.carbsTargetG,
                          'fat': profile.fatTargetG,
                        },
                      ),
                    ),
                  ],
                ),
      ),
    );
  }
}

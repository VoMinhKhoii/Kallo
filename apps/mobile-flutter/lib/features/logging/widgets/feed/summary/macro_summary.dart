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

import 'package:flutter/material.dart';

import '../../../../../shared/widgets/gauge/calorie_dial.dart';
import '../../../../../shared/widgets/gauge/macros/macro_dial_row.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_palette.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../data/logging_models.dart';
import '../../../logic/feed/view_state.dart';
import '../../../logic/logging_spacing.dart';
import '../../composer/entrances.dart';
import '../placeholder/loading_skeletons.dart';

class MacroSummary extends StatelessWidget {
  const MacroSummary({
    super.key,
    required this.view,
    required this.profile,
    this.pane = false,
  });

  final FeedViewState view;
  final LoggingProfile profile;

  /// Beside the days in a two-pane window: the pane supplies the side
  /// insets, so the row takes none of its own.
  final bool pane;

  @override
  Widget build(BuildContext context) {
    return FadeInUp(
      child: Container(
        // Clear in Aurora, so the page's glow runs on behind the dials
        // instead of stopping at a canvas-coloured band. The header sits in
        // a Column above the feed — nothing scrolls under it to hide.
        color:
            KalloPalette.currentId == KalloPaletteId.aurora
                ? null
                : KalloColors.surface,
        padding: EdgeInsets.fromLTRB(
          pane ? 0 : KalloSpacing.sp3,
          LoggingSpacing.block,
          pane ? 0 : KalloSpacing.sp3,
          LoggingSpacing.block,
        ),
        child:
            view.isLoading
                ? const MacroSummarySkeleton()
                : LayoutBuilder(
                  builder: (context, constraints) {
                    // What the macros can spare at their full size: the
                    // calorie dial shrinks and drops its verb before it
                    // squeezes them (review of #396).
                    final room = calorieDialRoom(constraints.maxWidth);
                    // The row spaces all four marks evenly, so the header
                    // reads as one row at any width (see leadRowFit). The
                    // screen inset either side stays at the app-wide 12.
                    return MacroDialRow.compact(
                      leading: CalorieDial.compact(
                        logged: view.dailyCalories.toDouble(),
                        target: profile.calorieTarget.toDouble(),
                        goal: profile.goal,
                        atLeast: view.incompleteTotals.contains('calories'),
                        maxWidth: room,
                      ),
                      leadingWidth: compactCalorieDialRadius(room) * 2,
                      atLeast: view.incompleteTotals,
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
                    );
                  },
                ),
      ),
    );
  }
}

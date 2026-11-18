/// Today's four dials: the calorie dial over the macro row, or all four in
/// one row when the window is too short to stack them.
///
/// Stacked, the calorie dial and the macros take about 300pt, which a short
/// window does not have left under the header and the week strip: the macros
/// were cut off by the bottom edge. When to use the row is
/// [todayDialsInOneRow]'s decision, shared with the loading skeleton.
library;

import 'package:flutter/material.dart';

import '../../../../shared/widgets/gauge/calorie_dial.dart';
import '../../../../shared/widgets/gauge/macros/macro_dial_row.dart';
import '../../logic/dashboard_spacing.dart';
import '../../logic/today_dial_layout.dart';
import 'dock_targets.dart';

class TodayDials extends StatefulWidget {
  const TodayDials({
    super.key,
    required this.calories,
    required this.targets,
    required this.current,
  });

  final int calories;
  final DockTargets targets;

  /// Grams eaten, keyed like [MacroDialRow.current].
  final Map<String, int> current;

  @override
  State<TodayDials> createState() => _TodayDialsState();
}

class _TodayDialsState extends State<TodayDials> {
  // The calorie dial moves between the column and the row under this key, so
  // a rotation carries its arc across instead of sweeping it in again.
  final _calorieKey = GlobalKey(debugLabel: 'today-calorie-dial');

  @override
  Widget build(BuildContext context) {
    final targets = widget.targets;
    final calorie = CalorieDial(
      key: _calorieKey,
      logged: widget.calories.toDouble(),
      target: targets.calorieTarget,
      goal: targets.goal,
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        final row = todayDialsInOneRow(context, constraints.maxWidth);
        final macros = MacroDialRow(
          leading: row ? calorie : null,
          leadingWidth: row ? kCalorieDialRadius * 2 : 0,
          // Centred on the calorie dial, the three small arcs sit level with
          // its figures rather than hanging from its top edge.
          crossAxisAlignment:
              row ? CrossAxisAlignment.center : CrossAxisAlignment.start,
          current: widget.current,
          target: {
            'protein': targets.proteinTargetG.round(),
            'carbohydrate': targets.carbsTargetG.round(),
            'fat': targets.fatTargetG.round(),
          },
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!row) ...[
              calorie,
              const SizedBox(height: DashboardSpacing.block),
            ],
            macros,
          ],
        );
      },
    );
  }
}

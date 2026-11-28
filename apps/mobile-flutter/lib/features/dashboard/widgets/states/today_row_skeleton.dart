import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../shared/widgets/gauge/calorie_dial.dart';
import '../../../../shared/widgets/gauge/macros/macro_dial_row.dart';
import '../../../../shared/widgets/gauge/rounded_gauge_arc.dart';
import '../../../../theme/kallo_theme.dart';

/// Stands in for Today's four dials when they draw in one row (see
/// `todayDialsInOneRow`): one wide mark for the calorie arc, three small ones
/// for the macros, each a pill the size its arc draws at.
///
/// Spaced by the live row's own [leadRowFit], so the calorie placeholder
/// covers exactly the rect its arc lands on and nothing slides sideways when
/// the day arrives.
class TodayRowSkeleton extends StatelessWidget {
  const TodayRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      const calorie = kCalorieDialRadius;
      final fit = leadRowFit(
        constraints.maxWidth,
        leadingWidth: calorie * 2,
        maxRadius: kMacroDialRadius,
      );
      return SkeletonPulse(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Padding(
              padding: EdgeInsets.symmetric(horizontal: fit.inset),
              child: SkeletonBar(
                width: calorie * 2,
                height: gaugeHeight(calorie),
                radius: KalloRadii.pill,
              ),
            ),
            for (var i = 0; i < 3; i++) ...[
              const SizedBox(width: kMacroDialGutter),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // The macro's label, then the arc under the same 6 gap
                    // the full-size dial keeps.
                    const SkeletonBar(
                      width: 64,
                      height: 14,
                      radius: KalloRadii.pill,
                    ),
                    const SizedBox(height: KalloSpacing.sp1_5),
                    SkeletonBar(
                      width: fit.radius * 2,
                      height: gaugeHeight(fit.radius),
                      radius: KalloRadii.pill,
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      );
    },
  );
}

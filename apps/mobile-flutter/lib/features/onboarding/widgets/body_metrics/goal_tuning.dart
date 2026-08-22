import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/profile/onboarding.dart';
import '../../../../shared/logic/display_format.dart' show formatCount;
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';
import '../aggression_slider.dart';
import 'carb_split_picker.dart';
import 'daily_target_card.dart';
import 'field_label.dart';
import 'goal_strip.dart';

/// The live targets card: TDEE readout, goal picker, pace slider (when not
/// maintaining), and the carb-split macro planner. Port of
/// `components/onboarding/body-metrics/goal-tuning.tsx`.
class GoalTuning extends StatelessWidget {
  const GoalTuning({
    super.key,
    required this.tdee,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.macros,
    required this.onGoalChanged,
    required this.onAggressionChanged,
    required this.onCarbSplitChanged,
  });

  final int tdee;
  final String goal;
  final double? aggression;
  final String carbSplit;
  final MacroTargets? macros;

  final ValueChanged<String> onGoalChanged;
  final ValueChanged<double> onAggressionChanged;
  final ValueChanged<String> onCarbSplitChanged;

  @override
  Widget build(BuildContext context) {
    final targetCalories = macros?.calories ?? 0;
    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp5),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: KalloColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // TDEE hero + goal control, with a bottom divider (#EAE7E0/80).
          _TdeeHero(tdee: tdee),
          const SizedBox(height: KalloSpacing.sp4), // gap-4
          FieldLabel(tr('onboarding.bodyMetrics.goal')),
          const SizedBox(height: KalloSpacing.sp2), // mb-2
          GoalStrip(value: goal, onChange: onGoalChanged),
          const SizedBox(height: KalloSpacing.sp4), // pb-4 divider gap
          const _Divider(color: Color(0xCCE8E6DC)), // border @80%

          if (goal != 'maintaining') ...[
            const SizedBox(height: KalloSpacing.sp4), // space-y-4
            AggressionSlider(
              value: aggression,
              goal: goal == 'cutting' ? 'cutting' : 'bulking',
              onChange: onAggressionChanged,
            ),
          ],

          if (targetCalories > 0) ...[
            const SizedBox(height: KalloSpacing.sp4), // space-y-4
            // Daily-target hero card — calorie target + caption + P/C/F for the
            // selected split. Sits right below the goal toggle.
            DailyTargetCard(
              calorieTarget: targetCalories,
              tdee: tdee,
              goal: goal,
              macros: macros,
            ),
            const SizedBox(height: KalloSpacing.sp4),
            CarbSplitPicker(
              value: carbSplit,
              targetCalories: targetCalories,
              onChange: onCarbSplitChanged,
            ),
          ],
        ],
      ),
    );
  }
}

/// TDEE hero: uppercase label + serif 36px "~{tdee}" + 18px sans "kcal".
class _TdeeHero extends StatelessWidget {
  const _TdeeHero({required this.tdee});
  final int tdee;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FieldLabel(tr('onboarding.bodyMetrics.tdee')),
        const SizedBox(height: KalloSpacing.sp1), // mb-1
        Text.rich(
          TextSpan(
            children: [
              TextSpan(text: '~${formatCount(tdee, locale)} '),
              TextSpan(
                text: tr('onboarding.bodyMetrics.kcal'),
                style: dashMeta(),
              ),
            ],
          ),
          // text-4xl (36px) tracking-tighter
          style: KalloTextStyles.serifRegular(
            fontSize: 36,
          ).copyWith(letterSpacing: -1, color: KalloColors.text),
        ),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => Container(height: 1, color: color);
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/logic/display_format.dart'
    show formatCount, formatOneDecimal, localeOf;
import '../../../models/profile/onboarding.dart';
import '../../../shared/widgets/form/option_row.dart';
import '../../../theme/kallo_theme.dart';
import '../data/constants.dart';
import '../logic/onboarding_answers.dart';
import '../widgets/pace_ruler.dart';

/// Screen 4 — "Your goal", and how fast.
///
/// Maintaining hides the ruler outright rather than disabling it: there is no
/// pace to set when the target IS the TDEE, and a greyed control on the page
/// only invites a tap that does nothing.
class StepGoal extends StatelessWidget {
  const StepGoal({
    super.key,
    required this.answers,
    required this.onChanged,
  });

  final OnboardingAnswers answers;
  final VoidCallback onChanged;

  static const List<({Goal value, String key})> goals = [
    (value: Goal.cutting, key: 'onboarding.bodyMetrics.cutting'),
    (value: Goal.maintaining, key: 'onboarding.bodyMetrics.maintaining'),
    (value: Goal.bulking, key: 'onboarding.bodyMetrics.bulking'),
  ];

  static const double goalRowHeight = 56;

  @override
  Widget build(BuildContext context) {
    // OptionRow already ticks the haptic on a CHANGE (never on a re-tap), so
    // the goal rows get the selection feedback the spec asks for for free.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final goal in goals) ...[
          if (goal != goals.first) const SizedBox(height: KalloSpacing.sp3),
          OptionRow(
            label: tr(goal.key),
            height: goalRowHeight,
            selected: answers.goal == goal.value,
            onTap: () {
              answers.goal = goal.value;
              onChanged();
            },
          ),
        ],
        if (answers.goal != Goal.maintaining) ...[
          const SizedBox(height: KalloSpacing.sp6),
          PaceRuler(
            value: answers.aggression ?? WizardDefaults.aggression,
            label: tr('onboarding.goal.paceLabel'),
            readout: _readout(context),
            lowLabel: tr('onboarding.goal.paceLow'),
            highLabel: tr('onboarding.goal.paceHigh'),
            onChanged: (value) {
              answers.aggression = value;
              onChanged();
            },
          ),
        ],
      ],
    );
  }

  String _readout(BuildContext context) => tr(
        'onboarding.goal.paceReadout',
        namedArgs: {
          'pace': formatOneDecimal(
            answers.aggression ?? WizardDefaults.aggression,
            localeOf(context),
          ),
          'kcal': formatCount(answers.paceKcal, localeOf(context)),
          'direction': tr(
            answers.goal == Goal.cutting
                ? 'onboarding.goal.paceDeficit'
                : 'onboarding.goal.paceSurplus',
          ),
        },
      );
}

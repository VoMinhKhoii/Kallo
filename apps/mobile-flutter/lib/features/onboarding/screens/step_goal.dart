import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/logic/display_format.dart'
    show formatCount, formatOneDecimal, localeOf;
import '../../../models/profile/onboarding.dart';
import '../../../shared/widgets/form/option_row.dart';
import '../../../theme/kallo_theme.dart';
import '../data/constants.dart';
import '../logic/onboarding_answers.dart';
import '../logic/onboarding_step_spec.dart';
import '../widgets/pace_ruler.dart';

/// Screen 4 — "Your goal", and how fast.
///
/// The goal opens on the one the body implies (BMI, with the WHO's Asian
/// action point where the origin calls for it) — see
/// `OnboardingAnswers.applyDefaultGoal`. Tapping any row makes the answer the
/// user's and stops the default tracking.
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

  /// How far the pace block recedes when there is no pace to set.
  static const double _dimmed = 0.35;

  @override
  Widget build(BuildContext context) {
    // OptionRow ticks the haptic on a CHANGE (never on a re-tap).
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
              // From here the answer is theirs: the BMI default stops moving.
              answers.goalChosenByUser = true;
              onChanged();
            },
          ),
        ],
        const SizedBox(height: KalloSpacing.sp6),
        // DIMMED on Maintaining, not removed. Dropping the block collapsed the
        // page by 120pt the instant the middle row was tapped, and the two
        // neighbours then jumped under the finger; greyed out it stays put and
        // says plainly that there is no pace to set when the target IS TDEE.
        IgnorePointer(
          ignoring: answers.goal == Goal.maintaining,
          child: Opacity(
            opacity: answers.goal == Goal.maintaining ? _dimmed : 1,
            child: PaceRuler(
              value: answers.aggression ?? WizardDefaults.aggression,
              label: tr('onboarding.goal.paceLabel'),
              hero: _hero(context),
              note: _note(context),
              lowLabel: tr('onboarding.goal.paceLow'),
              highLabel: tr('onboarding.goal.paceHigh'),
              onChanged: (value) {
                answers.aggression = value;
                onChanged();
              },
            ),
          ),
        ),
      ],
    );
  }

  String _hero(BuildContext context) => tr(
        'onboarding.goal.paceHero',
        namedArgs: {
          'pace': formatOneDecimal(
            answers.aggression ?? WizardDefaults.aggression,
            localeOf(context),
          ),
        },
      );

  String _note(BuildContext context) {
    // On Maintaining the target IS TDEE: "0 kcal surplus" would be nonsense.
    if (answers.goal == Goal.maintaining) {
      return tr('onboarding.goal.paceMaintaining');
    }
    return tr(
      'onboarding.goal.paceNote',
      namedArgs: {
        'kcal': formatCount(answers.paceKcal, localeOf(context)),
        'direction': tr(
          answers.goal == Goal.cutting
              ? 'onboarding.goal.paceDeficit'
              : 'onboarding.goal.paceSurplus',
        ),
      },
    );
  }
}

/// Screen 4's contract.
OnboardingStepSpec stepGoalSpec({
  required OnboardingAnswers answers,
  required VoidCallback onChanged,
}) => (
      title: tr('onboarding.goal.title'),
      body: StepGoal(answers: answers, onChanged: onChanged),
      ctaLabel: tr('onboarding.continueLabel'),
      ctaEnabled: true,
    );

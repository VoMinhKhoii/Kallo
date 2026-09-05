import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../shared/widgets/form/option_strip.dart' show OptionStripItem;
import '../../../shared/widgets/form/segmented_strip.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';

/// One cooking question: its group label, its options' l10n keys, and the two
/// accessors that read and write the answer on [CookingHabits].
///
/// The options come off the ENUM rather than being spelled out again — this
/// list used to carry its own copy of all five value sets, which is exactly the
/// copy that could drift from the payload the server accepts.
typedef CookingHabit = ({
  String label,
  List<Enum> values,
  List<String> optionLabels,
  Enum Function(CookingHabits) read,
  CookingHabits Function(CookingHabits, Enum) write,
});

/// Screen 5 — "Your cooking habits".
///
/// Five strips, every one of them opening on its middle answer. That is the
/// point of the screen: it is a calibration, not an interview, and a user who
/// recognises their kitchen in the defaults should be able to tap Continue.
class StepCooking extends StatelessWidget {
  const StepCooking({
    super.key,
    required this.answers,
    required this.onChanged,
  });

  final OnboardingAnswers answers;
  final VoidCallback onChanged;

  static final List<CookingHabit> habits = [
    (
      label: 'onboarding.cooking.stepLabels.oil',
      values: OilUsage.values,
      optionLabels: const [
        'onboarding.cooking.oilMinimal',
        'onboarding.cooking.oilNormal',
        'onboarding.cooking.oilHeavy',
      ],
      read: (c) => c.oilUsage,
      write: (c, v) => c.copyWith(oilUsage: v as OilUsage),
    ),
    (
      label: 'onboarding.cooking.stepLabels.rice',
      values: RicePortion.values,
      optionLabels: const [
        'onboarding.cooking.riceSmall',
        'onboarding.cooking.riceMedium',
        'onboarding.cooking.riceLarge',
      ],
      read: (c) => c.defaultRicePortion,
      write: (c, v) => c.copyWith(defaultRicePortion: v as RicePortion),
    ),
    (
      label: 'onboarding.cooking.stepLabels.sugar',
      values: SugarBraised.values,
      optionLabels: const [
        'onboarding.cooking.sugarLow',
        'onboarding.cooking.sugarMedium',
        'onboarding.cooking.sugarHigh',
      ],
      read: (c) => c.sugarBraised,
      write: (c, v) => c.copyWith(sugarBraised: v as SugarBraised),
    ),
    (
      label: 'onboarding.cooking.stepLabels.protein',
      values: ProteinPortion.values,
      optionLabels: const [
        'onboarding.cooking.proteinSmall',
        'onboarding.cooking.proteinMedium',
        'onboarding.cooking.proteinLarge',
      ],
      read: (c) => c.defaultProteinPortion,
      write: (c, v) => c.copyWith(defaultProteinPortion: v as ProteinPortion),
    ),
    (
      label: 'onboarding.cooking.stepLabels.broth',
      values: BrothConsumption.values,
      optionLabels: const [
        'onboarding.cooking.brothLeave',
        'onboarding.cooking.brothSome',
        'onboarding.cooking.brothFinish',
      ],
      read: (c) => c.brothConsumption,
      write: (c, v) => c.copyWith(brothConsumption: v as BrothConsumption),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final habit in habits) ...[
          if (habit != habits.first) const SizedBox(height: KalloSpacing.sp3),
          GroupLabel(tr(habit.label)),
          const SizedBox(height: KalloSpacing.sp1),
          SegmentedStrip(
            options: [
              for (var i = 0; i < habit.values.length; i++)
                OptionStripItem(
                  // The strip identifies a segment by string; the enum's own
                  // member name is that string, and it never leaves this file.
                  value: habit.values[i].name,
                  label: tr(habit.optionLabels[i]),
                ),
            ],
            activeIndex: habit.values.indexOf(habit.read(answers.cooking)),
            onChange: (value) {
              final picked = habit.values.firstWhere((v) => v.name == value);
              answers.cooking = habit.write(answers.cooking, picked);
              onChanged();
            },
          ),
        ],
      ],
    );
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../shared/widgets/form/option_row.dart';
import '../../../shared/widgets/form/option_strip.dart' show OptionStripItem;
import '../../../shared/widgets/form/segmented_strip.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';
import '../widgets/fields/unit_field.dart';

/// Screen 3 — "About you": sex, the three metrics, activity level.
///
/// Everything here is optional in the copy and that is honoured literally: a
/// blank field advances (screen 6 then offers the unlock card instead of a
/// target). Only a value that is out of range holds Continue, because that one
/// cannot be stored at all — and it says so in red under the row.
class StepAboutYou extends StatelessWidget {
  const StepAboutYou({
    super.key,
    required this.answers,
    required this.onChanged,
  });

  final OnboardingAnswers answers;
  final VoidCallback onChanged;

  static const List<({ActivityLevel value, String label, String hint})>
      activities = [
    (
      value: ActivityLevel.sedentary,
      label: 'onboarding.bodyMetrics.sedentary',
      hint: 'onboarding.bodyMetrics.sedentaryHint',
    ),
    (
      value: ActivityLevel.light,
      label: 'onboarding.bodyMetrics.light',
      hint: 'onboarding.bodyMetrics.lightHint',
    ),
    (
      value: ActivityLevel.moderate,
      label: 'onboarding.bodyMetrics.moderate',
      hint: 'onboarding.bodyMetrics.moderateHint',
    ),
    (
      value: ActivityLevel.veryActive,
      label: 'onboarding.bodyMetrics.veryActive',
      hint: 'onboarding.bodyMetrics.veryActiveHint',
    ),
  ];

  static const double activityRowHeight = 56;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _sex(),
        const SizedBox(height: KalloSpacing.sp3),
        _metrics(),
        ..._errors(),
        const SizedBox(height: KalloSpacing.sp3),
        GroupLabel(tr('onboarding.bodyMetrics.activityLevel')),
        for (final activity in activities) ...[
          const SizedBox(height: KalloSpacing.sp2),
          OptionRow(
            label: tr(activity.label),
            subline: tr(activity.hint),
            height: activityRowHeight,
            selected: answers.activityLevel == activity.value,
            onTap: () {
              answers.activityLevel = activity.value;
              onChanged();
            },
          ),
        ],
      ],
    );
  }

  Widget _sex() {
    final sex = answers.biologicalSex;
    return SegmentedStrip(
      options: [
        OptionStripItem(
          value: BiologicalSex.male.name,
          label: tr('onboarding.bodyMetrics.male'),
        ),
        OptionStripItem(
          value: BiologicalSex.female.name,
          label: tr('onboarding.bodyMetrics.female'),
        ),
      ],
      // -1 leaves the thumb absent rather than parking it on an answer the
      // user never gave.
      activeIndex: sex == null ? -1 : BiologicalSex.values.indexOf(sex),
      onChange: (value) {
        answers.biologicalSex = tryParseBiologicalSex(value);
        onChanged();
      },
    );
  }

  Widget _metrics() => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: UnitField(
              label: tr('onboarding.bodyMetrics.weight'),
              unit: tr('onboarding.bodyMetrics.weightUnit'),
              initialValue: answers.weightKg,
              hasError: answers.weightOutOfRange,
              onChanged: (value) {
                answers.weightKg = value;
                onChanged();
              },
            ),
          ),
          const SizedBox(width: KalloSpacing.sp2),
          Expanded(
            child: UnitField(
              label: tr('onboarding.bodyMetrics.height'),
              unit: tr('onboarding.bodyMetrics.heightUnit'),
              initialValue: answers.heightCm?.toDouble(),
              integer: true,
              hasError: answers.heightOutOfRange,
              onChanged: (value) {
                answers.heightCm = value?.toInt();
                onChanged();
              },
            ),
          ),
          const SizedBox(width: KalloSpacing.sp2),
          Expanded(
            child: UnitField(
              label: tr('onboarding.bodyMetrics.age'),
              unit: tr('onboarding.bodyMetrics.ageUnit'),
              initialValue: answers.age?.toDouble(),
              integer: true,
              hasError: answers.ageOutOfRange,
              onChanged: (value) {
                answers.age = value?.toInt();
                onChanged();
              },
            ),
          ),
        ],
      );

  /// Errors sit under the whole ROW, not under their own field: at a third of
  /// the width "Weight must be at least 30 kg." wraps to three lines and shunts
  /// its two neighbours' pills out of alignment.
  List<Widget> _errors() {
    String? bound(bool over, num? value, ({num min, num max}) range,
        String minKey, String maxKey) {
      if (!over || value == null) return null;
      return tr(value < range.min ? minKey : maxKey);
    }

    final messages = <String>[
      for (final message in [
        bound(answers.weightOutOfRange, answers.weightKg, kWeightRange,
            'validation.bodyMetrics.weightMin',
            'validation.bodyMetrics.weightMax'),
        bound(answers.heightOutOfRange, answers.heightCm, kHeightRange,
            'validation.bodyMetrics.heightMin',
            'validation.bodyMetrics.heightMax'),
        bound(answers.ageOutOfRange, answers.age, kAgeRange,
            'validation.bodyMetrics.ageMin', 'validation.bodyMetrics.ageMax'),
      ])
        if (message != null) message,
    ];
    if (messages.isEmpty) return const [];
    return [
      const SizedBox(height: KalloSpacing.sp2),
      for (final message in messages)
        Text(message, style: dashMeta(color: KalloColors.danger)),
    ];
  }
}

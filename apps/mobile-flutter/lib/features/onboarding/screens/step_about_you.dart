import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../shared/widgets/form/option_row.dart';
import '../../../shared/widgets/form/option_strip.dart' show OptionStripItem;
import '../../../shared/widgets/form/segmented/segmented_strip.dart';
import '../../../shared/widgets/typography/section_header_row.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/constants.dart';
import '../logic/onboarding_answers.dart';
import '../logic/onboarding_step_spec.dart';
import '../widgets/fields/unit_field.dart';

/// Screen 3 — "About you": sex, the three metrics, activity level. Every field
/// is optional and that is honoured literally — a blank one advances. Only an
/// out-of-range value holds Continue, and says so in red under the row.
///
/// Picking a sex PRE-FILLS the empty metrics with [kSexMetricDefaults], so a
/// user who answers one question already has a target waiting on screen 6.
/// Only the fields this screen filled are ever replaced: a typed value and a
/// value seeded from the saved profile both survive a re-pick untouched.
class StepAboutYou extends StatefulWidget {
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

  @override
  State<StepAboutYou> createState() => _StepAboutYouState();
}

class _StepAboutYouState extends State<StepAboutYou> {
  /// The metrics currently holding a per-sex default rather than an answer.
  /// Scoped to this VISIT of the screen: leaving and coming back forgets them,
  /// which errs the safe way — a remembered value is then never overwritten.
  final Set<TargetInput> _autofilled = {};

  /// Bumped whenever a sex pick rewrites the fields, and mixed into their keys
  /// so the [UnitField]s re-seed. They deliberately do NOT track their value
  /// afterwards — re-syncing every rebuild fights a half-typed "65,".
  int _generation = 0;

  OnboardingAnswers get answers => widget.answers;

  void _pickSex(BiologicalSex? sex) {
    answers.biologicalSex = sex;
    final defaults = sex == null ? null : kSexMetricDefaults[sex];
    if (defaults != null) {
      var filled = false;
      if (_fillable(TargetInput.weightKg, answers.weightKg)) {
        answers.weightKg = defaults.weightKg;
        _autofilled.add(TargetInput.weightKg);
        filled = true;
      }
      if (_fillable(TargetInput.heightCm, answers.heightCm)) {
        answers.heightCm = defaults.heightCm;
        _autofilled.add(TargetInput.heightCm);
        filled = true;
      }
      if (_fillable(TargetInput.age, answers.age)) {
        answers.age = defaults.age;
        _autofilled.add(TargetInput.age);
        filled = true;
      }
      if (filled) _generation++;
    }
    setState(() {});
    widget.onChanged();
  }

  /// Empty, or still holding the default the OTHER sex put there.
  bool _fillable(TargetInput field, num? value) =>
      value == null || _autofilled.contains(field);

  /// A value the user typed is theirs from then on.
  void _typed(TargetInput field) => _autofilled.remove(field);

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
        // The same anatomy as the language and country rows — OptionRow's own
        // 64pt height and a 12pt gap. At 56 with a subline inside, the four
        // rows read as a packed list rather than as four choices.
        for (final activity in StepAboutYou.activities) ...[
          const SizedBox(height: KalloSpacing.sp3),
          OptionRow(
            label: tr(activity.label),
            subline: tr(activity.hint),
            selected: answers.activityLevel == activity.value,
            onTap: () {
              answers.activityLevel = activity.value;
              widget.onChanged();
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
      onChange: (value) => _pickSex(tryParseBiologicalSex(value)),
    );
  }

  Widget _metrics() => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: UnitField(
              key: ValueKey('weight.$_generation'),
              label: tr('onboarding.bodyMetrics.weight'),
              unit: tr('onboarding.bodyMetrics.weightUnit'),
              initialValue: answers.weightKg,
              hasError: answers.weightOutOfRange,
              onChanged: (value) {
                answers.weightKg = value;
                _typed(TargetInput.weightKg);
                widget.onChanged();
              },
            ),
          ),
          const SizedBox(width: KalloSpacing.sp2),
          Expanded(
            child: UnitField(
              label: tr('onboarding.bodyMetrics.height'),
              unit: tr('onboarding.bodyMetrics.heightUnit'),
              key: ValueKey('height.$_generation'),
              initialValue: answers.heightCm?.toDouble(),
              integer: true,
              hasError: answers.heightOutOfRange,
              onChanged: (value) {
                answers.heightCm = value?.toInt();
                _typed(TargetInput.heightCm);
                widget.onChanged();
              },
            ),
          ),
          const SizedBox(width: KalloSpacing.sp2),
          Expanded(
            child: UnitField(
              label: tr('onboarding.bodyMetrics.age'),
              unit: tr('onboarding.bodyMetrics.ageUnit'),
              key: ValueKey('age.$_generation'),
              initialValue: answers.age?.toDouble(),
              integer: true,
              hasError: answers.ageOutOfRange,
              onChanged: (value) {
                answers.age = value?.toInt();
                _typed(TargetInput.age);
                widget.onChanged();
              },
            ),
          ),
        ],
      );

  /// Errors sit under the whole ROW: at a third of the width "Weight must be
  /// at least 30 kg." wraps to three lines and shunts its neighbours.
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

/// Screen 3's contract: the ONE screen that can hold the CTA — a metric out of
/// range cannot be stored, so Continue waits for it (a BLANK one may pass).
OnboardingStepSpec stepAboutYouSpec({
  required OnboardingAnswers answers,
  required VoidCallback onChanged,
}) => (
      title: tr('onboarding.aboutYou.title'),
      body: StepAboutYou(answers: answers, onChanged: onChanged),
      ctaLabel: tr('onboarding.continueLabel'),
      ctaEnabled: answers.metricsValid,
    );

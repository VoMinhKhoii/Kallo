import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/form/decimal_input.dart';
import '../../../../shared/widgets/form/option_strip.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../custom_select.dart';
import 'field_label.dart';

/// "About you" card: sex, weight, height, age, activity level. Port of
/// `components/onboarding/body-metrics/about-you-fields.tsx`.
///
/// No "About you" header: it repeated the subtitle above the card almost word
/// for word, and its ALL-CAPS eyebrow was a fourth type size on the screen. The
/// subtitle now carries the "optional" half of what it used to say.
class AboutYouFields extends StatelessWidget {
  const AboutYouFields({
    super.key,
    required this.sex,
    required this.weightKg,
    required this.heightCm,
    required this.age,
    required this.activityLevel,
    required this.weightError,
    required this.heightError,
    required this.ageError,
    required this.onSexChanged,
    required this.onWeightChanged,
    required this.onHeightChanged,
    required this.onAgeChanged,
    required this.onActivityChanged,
  });

  final String? sex;
  final double? weightKg;
  final int? heightCm;
  final int? age;
  final String activityLevel;

  final String? weightError;
  final String? heightError;
  final String? ageError;

  final ValueChanged<String> onSexChanged;
  final ValueChanged<double?> onWeightChanged;
  final ValueChanged<int?> onHeightChanged;
  final ValueChanged<int?> onAgeChanged;
  final ValueChanged<String> onActivityChanged;

  @override
  Widget build(BuildContext context) {
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
          // biological sex (full) — two options, so a 2-segment strip rather
          // than a select popover (a tap-to-open menu for a binary choice).
          FieldLabel(tr('onboarding.bodyMetrics.biologicalSex')),
          const SizedBox(height: 6),
          OptionStrip.onboarding(
            value: sex ?? '',
            options: [
              OptionStripItem(
                label: tr('onboarding.bodyMetrics.male'),
                value: 'male',
              ),
              OptionStripItem(
                label: tr('onboarding.bodyMetrics.female'),
                value: 'female',
              ),
            ],
            onChange: onSexChanged,
          ),
          const SizedBox(height: KalloSpacing.sp4),

          // weight + height row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Cell(
                  label:
                      '${tr('onboarding.bodyMetrics.weight')} (${tr('onboarding.bodyMetrics.weightUnit')})',
                  error: weightError,
                  child: DecimalInput(
                    value: weightKg,
                    hintText: '65',
                    onValueChange: onWeightChanged,
                  ),
                ),
              ),
              const SizedBox(width: KalloSpacing.sp4),
              Expanded(
                child: _Cell(
                  label:
                      '${tr('onboarding.bodyMetrics.height')} (${tr('onboarding.bodyMetrics.heightUnit')})',
                  error: heightError,
                  child: DecimalInput(
                    integer: true,
                    value: heightCm?.toDouble(),
                    hintText: '170',
                    onValueChange: (v) => onHeightChanged(v?.toInt()),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp4),

          // age row (+ empty cell)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Cell(
                  label: tr('onboarding.bodyMetrics.age'),
                  error: ageError,
                  child: DecimalInput(
                    integer: true,
                    value: age?.toDouble(),
                    hintText: '25',
                    onValueChange: (v) => onAgeChanged(v?.toInt()),
                  ),
                ),
              ),
              const SizedBox(width: KalloSpacing.sp4),
              const Expanded(child: SizedBox()),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp4),

          // activity level (full)
          FieldLabel(tr('onboarding.bodyMetrics.activityLevel')),
          const SizedBox(height: 6),
          CustomSelect(
            value: activityLevel,
            options: [
              CustomSelectOption(
                label: tr('onboarding.bodyMetrics.sedentary'),
                value: 'sedentary',
              ),
              CustomSelectOption(
                label: tr('onboarding.bodyMetrics.light'),
                value: 'light',
              ),
              CustomSelectOption(
                label: tr('onboarding.bodyMetrics.moderate'),
                value: 'moderate',
              ),
              CustomSelectOption(
                label: tr('onboarding.bodyMetrics.veryActive'),
                value: 'very_active',
              ),
            ],
            onChange: onActivityChanged,
          ),
        ],
      ),
    );
  }
}

/// One labelled field with an optional inline range error underneath.
class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.child, this.error});

  final String label;
  final Widget child;
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label),
        const SizedBox(height: 6),
        child,
        if (error != null) ...[
          const SizedBox(height: 6),
          Text(error!, style: dashMeta(color: KalloColors.danger)),
        ],
      ],
    );
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../../../shared/widgets/form/option_strip.dart';

/// Partial seed for step 3 (string values keyed by field name).
class ScreenThreeDefaults {
  final String? oilUsage;
  final String? defaultRicePortion;
  final String? sugarBraised;
  final String? defaultProteinPortion;
  final String? brothConsumption;

  const ScreenThreeDefaults({
    this.oilUsage,
    this.defaultRicePortion,
    this.sugarBraised,
    this.defaultProteinPortion,
    this.brothConsumption,
  });

  bool get allNull =>
      oilUsage == null &&
      defaultRicePortion == null &&
      sugarBraised == null &&
      defaultProteinPortion == null &&
      brothConsumption == null;
}

const Map<String, String> _neutralCookingDefaults = {
  'oilUsage': 'normal',
  'defaultRicePortion': 'medium',
  'sugarBraised': 'medium',
  'defaultProteinPortion': 'medium',
  'brothConsumption': 'some',
};

/// RN port of `components/onboarding/screens/screen-cooking.tsx` (step 3).
///
/// One-time pre-population with neutral defaults (so Next is enabled at once).
class ScreenCooking extends StatefulWidget {
  const ScreenCooking({
    super.key,
    required this.defaultValues,
    required this.onChange,
  });

  final ScreenThreeDefaults defaultValues;
  final ValueChanged<Map<String, dynamic>> onChange;

  @override
  State<ScreenCooking> createState() => _ScreenCookingState();
}

class _ScreenCookingState extends State<ScreenCooking> {
  late final Map<String, String> _values = widget.defaultValues.allNull
      ? Map<String, String>.from(_neutralCookingDefaults)
      : {
          ..._neutralCookingDefaults,
          if (widget.defaultValues.oilUsage != null)
            'oilUsage': widget.defaultValues.oilUsage!,
          if (widget.defaultValues.defaultRicePortion != null)
            'defaultRicePortion': widget.defaultValues.defaultRicePortion!,
          if (widget.defaultValues.sugarBraised != null)
            'sugarBraised': widget.defaultValues.sugarBraised!,
          if (widget.defaultValues.defaultProteinPortion != null)
            'defaultProteinPortion': widget.defaultValues.defaultProteinPortion!,
          if (widget.defaultValues.brothConsumption != null)
            'brothConsumption': widget.defaultValues.brothConsumption!,
        };

  @override
  void initState() {
    super.initState();
    // Report once on mount (neutral defaults pre-populate → Next enabled).
    WidgetsBinding.instance.addPostFrameCallback((_) => _report());
  }

  void _report() => widget.onChange(Map<String, dynamic>.from(_values));

  @override
  Widget build(BuildContext context) {
    final fields = <_CookingField>[
      _CookingField(
        name: 'oilUsage',
        label: tr('onboarding.cooking.oilUsage'),
        options: [
          OptionStripItem(
              value: 'minimal',
              label: tr('onboarding.cooking.oilMinimal'),
              hint: tr('onboarding.cooking.oilMinimalHint')),
          OptionStripItem(
              value: 'normal',
              label: tr('onboarding.cooking.oilNormal'),
              hint: tr('onboarding.cooking.oilNormalHint')),
          OptionStripItem(
              value: 'heavy',
              label: tr('onboarding.cooking.oilHeavy'),
              hint: tr('onboarding.cooking.oilHeavyHint')),
        ],
      ),
      _CookingField(
        name: 'defaultRicePortion',
        label: tr('onboarding.cooking.ricePortion'),
        options: [
          OptionStripItem(
              value: 'small',
              label: tr('onboarding.cooking.riceSmall'),
              hint: tr('onboarding.cooking.riceSmallHint')),
          OptionStripItem(
              value: 'medium',
              label: tr('onboarding.cooking.riceMedium'),
              hint: tr('onboarding.cooking.riceMediumHint')),
          OptionStripItem(
              value: 'large',
              label: tr('onboarding.cooking.riceLarge'),
              hint: tr('onboarding.cooking.riceLargeHint')),
        ],
      ),
      _CookingField(
        name: 'sugarBraised',
        label: tr('onboarding.cooking.sugar'),
        hint: tr('onboarding.cooking.sugarHint'),
        options: [
          OptionStripItem(
              value: 'low', label: tr('onboarding.cooking.sugarLow')),
          OptionStripItem(
              value: 'medium', label: tr('onboarding.cooking.sugarMedium')),
          OptionStripItem(
              value: 'high', label: tr('onboarding.cooking.sugarHigh')),
        ],
      ),
      _CookingField(
        name: 'defaultProteinPortion',
        label: tr('onboarding.cooking.proteinPortion'),
        options: [
          OptionStripItem(
              value: 'small',
              label: tr('onboarding.cooking.proteinSmall'),
              hint: tr('onboarding.cooking.proteinSmallHint')),
          OptionStripItem(
              value: 'medium',
              label: tr('onboarding.cooking.proteinMedium'),
              hint: tr('onboarding.cooking.proteinMediumHint')),
          OptionStripItem(
              value: 'large',
              label: tr('onboarding.cooking.proteinLarge'),
              hint: tr('onboarding.cooking.proteinLargeHint')),
        ],
      ),
      _CookingField(
        name: 'brothConsumption',
        label: tr('onboarding.cooking.broth'),
        options: [
          OptionStripItem(
              value: 'leave_it',
              label: tr('onboarding.cooking.brothLeave'),
              hint: tr('onboarding.cooking.brothLeaveHint')),
          OptionStripItem(
              value: 'some',
              label: tr('onboarding.cooking.brothSome'),
              hint: tr('onboarding.cooking.brothSomeHint')),
          OptionStripItem(
              value: 'finish_it',
              label: tr('onboarding.cooking.brothFinish'),
              hint: tr('onboarding.cooking.brothFinishHint')),
        ],
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          tr('onboarding.cooking.title'),
          style: KalloTextStyles.serifMedium(fontSize: 24)
              .copyWith(letterSpacing: -0.3, color: KalloColors.text),
        ),
        const SizedBox(height: KalloSpacing.sp1),
        Text(
          tr('onboarding.cooking.subtitle'),
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp6),
        for (var i = 0; i < fields.length; i++) ...[
          if (i > 0) const SizedBox(height: KalloSpacing.sp6),
          _buildCard(fields[i]),
        ],
      ],
    );
  }

  // Outer per-category card removed — each category renders flat (label + hint
  // + option strip), separated by the parent's gap.
  Widget _buildCard(_CookingField f) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          f.label,
          style: dashBody(weight: FontWeight.w500),
        ),
        if (f.hint != null)
          Padding(
            // RN marginTop: -space[1] then card gap[3] → net spacing.
            padding: const EdgeInsets.only(top: KalloSpacing.sp3 - KalloSpacing.sp1),
            child: Text(
              f.hint!,
              style: dashMeta(),
            ),
          ),
        const SizedBox(height: KalloSpacing.sp3),
        OptionStrip.onboarding(
          options: f.options,
          value: _values[f.name]!,
          onChange: (v) {
            setState(() => _values[f.name] = v);
            _report();
          },
        ),
      ],
    );
  }
}

class _CookingField {
  final String name;
  final String label;
  final String? hint;
  final List<OptionStripItem> options;
  const _CookingField({
    required this.name,
    required this.label,
    this.hint,
    required this.options,
  });
}

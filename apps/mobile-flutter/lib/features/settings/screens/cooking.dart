import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../../shared/widgets/form/option_strip.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../widgets/profile/profile_form_controller.dart';

/// RN port of web `components/settings/profile/cooking.tsx`. A stack of cards,
/// each with a section label + an [OptionStrip].
class Cooking extends StatelessWidget {
  const Cooking({super.key});

  @override
  Widget build(BuildContext context) {
    final form = ProfileFormController.of(context);
    final v = form.values;
    String t(String k) => tr('onboarding.cooking.$k');

    final fields = <_CookingField>[
      _CookingField(
        label: t('oilUsage'),
        value: v.oilUsage.name,
        options: [
          OptionStripItem(value: 'minimal', label: t('oilMinimal'), hint: t('oilMinimalHint')),
          OptionStripItem(value: 'normal', label: t('oilNormal'), hint: t('oilNormalHint')),
          OptionStripItem(value: 'heavy', label: t('oilHeavy'), hint: t('oilHeavyHint')),
        ],
        onChange: (s) => form.update(
            (f) => f.oilUsage = OilUsage.values.byName(s)),
      ),
      _CookingField(
        label: t('ricePortion'),
        value: v.defaultRicePortion.name,
        options: [
          OptionStripItem(value: 'small', label: t('riceSmall'), hint: t('riceSmallHint')),
          OptionStripItem(value: 'medium', label: t('riceMedium'), hint: t('riceMediumHint')),
          OptionStripItem(value: 'large', label: t('riceLarge'), hint: t('riceLargeHint')),
        ],
        onChange: (s) => form.update(
            (f) => f.defaultRicePortion = RicePortion.values.byName(s)),
      ),
      _CookingField(
        label: t('sugar'),
        value: v.sugarBraised.name,
        options: [
          OptionStripItem(value: 'low', label: t('sugarLow')),
          OptionStripItem(value: 'medium', label: t('sugarMedium')),
          OptionStripItem(value: 'high', label: t('sugarHigh')),
        ],
        onChange: (s) => form.update(
            (f) => f.sugarBraised = SugarBraised.values.byName(s)),
      ),
      _CookingField(
        label: t('proteinPortion'),
        value: v.defaultProteinPortion.name,
        options: [
          OptionStripItem(value: 'small', label: t('proteinSmall'), hint: t('proteinSmallHint')),
          OptionStripItem(value: 'medium', label: t('proteinMedium'), hint: t('proteinMediumHint')),
          OptionStripItem(value: 'large', label: t('proteinLarge'), hint: t('proteinLargeHint')),
        ],
        onChange: (s) => form.update(
            (f) => f.defaultProteinPortion = ProteinPortion.values.byName(s)),
      ),
      _CookingField(
        label: t('broth'),
        value: brothConsumptionToString(v.brothConsumption),
        options: [
          OptionStripItem(value: 'leave_it', label: t('brothLeave'), hint: t('brothLeaveHint')),
          OptionStripItem(value: 'some', label: t('brothSome'), hint: t('brothSomeHint')),
          OptionStripItem(value: 'finish_it', label: t('brothFinish'), hint: t('brothFinishHint')),
        ],
        onChange: (s) => form.update(
            (f) => f.brothConsumption = brothConsumptionFromString(s)),
      ),
    ];

    return Column(
      children: [
        for (var i = 0; i < fields.length; i++) ...[
          // One 12px step between cards — the app's single rhythm; the 24 this
          // replaced was compensating for borders the cards no longer have.
          if (i > 0) const SizedBox(height: KalloSpacing.sp3),
          _CookingCard(field: fields[i]),
        ],
      ],
    );
  }
}

class _CookingField {
  final String label;
  final String value;
  final List<OptionStripItem> options;
  final ValueChanged<String> onChange;
  const _CookingField({
    required this.label,
    required this.value,
    required this.options,
    required this.onChange,
  });
}

class _CookingCard extends StatelessWidget {
  const _CookingCard({required this.field});
  final _CookingField field;

  @override
  Widget build(BuildContext context) {
    return KalloCard(
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            field.label,
            style: dashBody(),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          OptionStrip.settings(
            options: field.options,
            value: field.value,
            onChange: field.onChange,
          ),
        ],
      ),
    );
  }
}

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../widgets/inputs/country_select.dart';
import '../widgets/profile/profile_form_controller.dart';

/// RN port of web `components/settings/profile/regional.tsx`. Description blurb
/// + two labelled [CountrySelect]s (origin / residence).
class Regional extends StatelessWidget {
  const Regional({super.key});

  @override
  Widget build(BuildContext context) {
    final form = ProfileFormController.of(context);
    final v = form.values;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          tr('settings.regionalPanel.description'),
          style: dashBody(color: kInkMuted),
        ),
        const SizedBox(height: KalloSpacing.sp5),
        _CountryField(
          icon: LucideIcons.globe300,
          label: tr('onboarding.origin.countryOfOrigin'),
          value: v.countryOfOrigin,
          onChange: (s) => form.update((f) => f.countryOfOrigin = s),
        ),
        const SizedBox(height: KalloSpacing.sp4),
        _CountryField(
          icon: LucideIcons.mapPin300,
          label: tr('onboarding.origin.countryOfResidence'),
          value: v.countryOfResidence,
          onChange: (s) => form.update((f) => f.countryOfResidence = s),
        ),
      ],
    );
  }
}

class _CountryField extends StatelessWidget {
  const _CountryField({
    required this.icon,
    required this.label,
    required this.value,
    required this.onChange,
  });

  final IconData icon;
  final String label;
  final String? value;
  final ValueChanged<String?> onChange;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: KalloColors.textMuted),
            const SizedBox(width: KalloSpacing.sp2),
            Text(
              label,
              style: dashBody(),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp2),
        CountrySelect(value: value, onChange: onChange),
      ],
    );
  }
}

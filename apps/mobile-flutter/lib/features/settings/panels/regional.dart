import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../controls/country_select.dart';
import '../widgets/profile_form_controller.dart';

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
        const SizedBox(height: NhamSpacing.sp5),
        _CountryField(
          icon: LucideIcons.globe,
          label: tr('onboarding.origin.countryOfOrigin'),
          value: v.countryOfOrigin,
          onChange: (s) => form.update((f) => f.countryOfOrigin = s),
        ),
        const SizedBox(height: NhamSpacing.sp4),
        _CountryField(
          icon: LucideIcons.mapPin,
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
            Icon(icon, size: 16, color: NhamColors.textMuted),
            const SizedBox(width: NhamSpacing.sp2),
            Text(
              label,
              style: dashBody(),
            ),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp2),
        CountrySelect(value: value, onChange: onChange),
      ],
    );
  }
}

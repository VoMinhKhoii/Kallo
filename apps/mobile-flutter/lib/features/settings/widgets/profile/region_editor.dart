import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../onboarding/widgets/language_toggle.dart';
import '../../data/profile_providers.dart';
import '../../screens/regional.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import 'instant_commit_editor.dart';
import 'profile_form_controller.dart';

/// The "Region & language" focused editor. Wraps the [Regional] country panel
/// (origin / residence) plus an app-language selector inside an
/// [InstantCommitEditor], so every change persists immediately. Switching the
/// language live-sets the app locale (the new locale is what
/// `buildProfilePayload` writes as `preferredLocale`).
class RegionEditor extends StatelessWidget {
  const RegionEditor({super.key, required this.profile});

  final ProfileRow profile;

  @override
  Widget build(BuildContext context) {
    return InstantCommitEditor(
      profile: profile,
      subtitle: tr('settings.profilePanel.regionalSubtitle'),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _LanguageField(),
          SizedBox(height: KalloSpacing.sp6),
          Regional(),
        ],
      ),
    );
  }
}

/// Language row: a labelled [LanguageToggle]. Switching the language sets the
/// app locale live and nudges the form controller so the instant-commit save
/// fires (persisting the new `preferredLocale`).
class _LanguageField extends StatefulWidget {
  const _LanguageField();

  @override
  State<_LanguageField> createState() => _LanguageFieldState();
}

class _LanguageFieldState extends State<_LanguageField> {
  @override
  Widget build(BuildContext context) {
    final form = ProfileFormController.of(context);
    final current = context.locale.languageCode;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Icon(
              LucideIcons.languages300,
              size: 16,
              color: KalloColors.textMuted,
            ),
            const SizedBox(width: KalloSpacing.sp2),
            Text(
              tr('settings.language'),
              style: dashBody(),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp2),
        LanguageToggle(
          value: current,
          onChange: (v) {
            if (v == current) return;
            context.setLocale(Locale(v)).then((_) {
              if (!mounted) return;
              // Nudge the controller to fire a notification. preferredLocale
              // lives outside the form, so InstantCommitEditor detects the
              // locale change and commits even though no field value changed.
              form.update((f) => f.countryOfResidence = f.countryOfResidence);
            });
          },
        ),
      ],
    );
  }
}

import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/form/option_row.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';
import '../logic/onboarding_step_spec.dart';
import '../../settings/logic/language_picker.dart';

/// Screen 1 — "Choose your language". Picking a row records `preferredLocale`
/// for the server AND live-switches the app with `context.setLocale`, so the
/// rest of the wizard is already in the chosen language by the next frame.
/// Signed in, the pick is stored on the account at once ([LanguagePicker]).
class StepLanguage extends ConsumerWidget {
  const StepLanguage({
    super.key,
    required this.answers,
    required this.deviceLanguage,
    required this.localeFromDevice,
    required this.onChanged,
    this.showSettingsNote = true,
  });

  final OnboardingAnswers answers;

  /// `en` / `vi` — what the phone speaks.
  final String deviceLanguage;

  /// Whether the preselection is the phone's guess rather than a saved answer.
  /// Only then does a row carry the "From your phone" note.
  final bool localeFromDevice;

  final VoidCallback onChanged;

  /// "You can change this any time in Settings" — reassurance in onboarding,
  /// nonsense on the Settings page that hosts this same body.
  final bool showSettingsNote;

  static const List<({String code, String key})> options = [
    (code: 'vi', key: 'onboarding.language.vietnamese'),
    (code: 'en', key: 'onboarding.language.english'),
  ];

  /// AWAIT the load before rebuilding: [EasyLocalization.setLocale] has to
  /// read the new locale's JSON before `tr()` answers in it, so an eager
  /// rebuild left the wizard's title and CTA (passed down as plain strings)
  /// in the old language.
  Future<void> _pick(BuildContext context, WidgetRef ref, String code) async {
    if (answers.preferredLocale == code) return;
    answers.preferredLocale = code;
    // Registered before the switch, so the account sync never sees the app
    // in a language nobody is saving.
    final saving = ref.read(languagePickerProvider).pick(code);
    await context.setLocale(Locale(code));
    onChanged();
    unawaited(
      saving.catchError((Object _) {
        if (!context.mounted) return;
        showTopToast(
          context,
          tr('settings.profilePanel.saveError'),
          variant: TopToastVariant.error,
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final option in options) ...[
          if (option != options.first) const SizedBox(height: KalloSpacing.sp3),
          OptionRow(
            label: tr(option.key),
            selected: answers.preferredLocale == option.code,
            note:
                localeFromDevice && option.code == deviceLanguage
                    ? tr('onboarding.fromDevice')
                    : null,
            onTap: () => _pick(context, ref, option.code),
          ),
        ],
        if (showSettingsNote) ...[
          const SizedBox(height: KalloSpacing.sp3),
          Text(
            tr('onboarding.language.meta'),
            textAlign: TextAlign.center,
            style: dashMeta(),
          ),
        ],
      ],
    );
  }
}

/// Screen 1's contract: a language is mandatory, so there is no Skip and the
/// CTA is never held — the step opens on the phone's guess.
OnboardingStepSpec stepLanguageSpec({
  required OnboardingAnswers answers,
  required String deviceLanguage,
  required bool localeFromDevice,
  required VoidCallback onChanged,
}) => (
  title: tr('onboarding.language.title'),
  body: StepLanguage(
    answers: answers,
    deviceLanguage: deviceLanguage,
    localeFromDevice: localeFromDevice,
    onChanged: onChanged,
  ),
  ctaLabel: tr('onboarding.continueLabel'),
  ctaEnabled: true,
);

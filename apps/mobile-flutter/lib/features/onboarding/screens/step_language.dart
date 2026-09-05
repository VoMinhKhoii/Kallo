import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/form/option_row.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';

/// Screen 1 — "Choose your language".
///
/// Picking a row does two things at once: it records `preferredLocale` for the
/// server AND live-switches the app with `context.setLocale`, so the rest of
/// the wizard is already in the chosen language by the next frame. Waiting for
/// the save would leave the user reading the wrong language for five screens.
class StepLanguage extends StatelessWidget {
  const StepLanguage({
    super.key,
    required this.answers,
    required this.deviceLanguage,
    required this.localeFromDevice,
    required this.onChanged,
  });

  final OnboardingAnswers answers;

  /// `en` / `vi` — what the phone speaks.
  final String deviceLanguage;

  /// Whether the preselection is the phone's guess rather than a saved answer.
  /// Only then does a row carry the "From your phone" note.
  final bool localeFromDevice;

  final VoidCallback onChanged;

  static const List<({String code, String key})> options = [
    (code: 'vi', key: 'onboarding.language.vietnamese'),
    (code: 'en', key: 'onboarding.language.english'),
  ];

  /// [EasyLocalization.setLocale] is asynchronous — it has to read the new
  /// locale's JSON before `tr()` answers in it. Rebuilding on the same frame
  /// therefore repainted the wizard with the OLD translations still loaded, and
  /// only the widgets the locale change itself rebuilt (this screen) came back
  /// in the new language: the page title and the CTA, which the wizard passes
  /// down as plain strings, stayed English. Awaiting the load first means one
  /// rebuild, in one language.
  Future<void> _pick(BuildContext context, String code) async {
    if (answers.preferredLocale == code) return;
    answers.preferredLocale = code;
    await context.setLocale(Locale(code));
    onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final option in options) ...[
          if (option != options.first)
            const SizedBox(height: KalloSpacing.sp3),
          OptionRow(
            label: tr(option.key),
            selected: answers.preferredLocale == option.code,
            note: localeFromDevice && option.code == deviceLanguage
                ? tr('onboarding.fromDevice')
                : null,
            onTap: () => _pick(context, option.code),
          ),
        ],
        const SizedBox(height: KalloSpacing.sp3),
        Text(
          tr('onboarding.language.meta'),
          textAlign: TextAlign.center,
          style: dashMeta(),
        ),
      ],
    );
  }
}

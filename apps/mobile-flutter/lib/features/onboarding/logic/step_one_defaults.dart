/// Mobile adaptation of RN `lib/onboarding/logic/step-one-defaults.ts`.
///
/// The web's sessionStorage locale-draft dance (for the mid-wizard locale switch
/// that remounts the app) is dropped — Flutter keeps in-memory wizard state and
/// does not live-switch the app locale, so there's no remount to survive.
library;

const List<String> _locales = ['en', 'vi'];
const String _defaultLocale = 'en';

class StepOneData {
  final String? countryOfOrigin;
  final String? countryOfResidence;
  final String preferredLocale;

  const StepOneData({
    required this.countryOfOrigin,
    required this.countryOfResidence,
    required this.preferredLocale,
  });
}

String? _toSupportedLocale(String? value) {
  if (value == null || !_locales.contains(value)) return null;
  return value;
}

StepOneData buildStepOneDefaults({
  String? activeLocale,
  String? countryOfOrigin,
  String? countryOfResidence,
  String? profilePreferredLocale,
}) {
  return StepOneData(
    countryOfOrigin: countryOfOrigin,
    countryOfResidence: countryOfResidence,
    preferredLocale: _toSupportedLocale(activeLocale) ??
        _toSupportedLocale(profilePreferredLocale) ??
        _defaultLocale,
  );
}

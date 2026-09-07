/// Device-region defaults for the "Where you cook" step. No web counterpart:
/// the platform locale already knows the region and the language, so the step
/// opens pre-answered with a "From your phone" note.
///
/// Everything here is pure except [deviceRegionCode]/[deviceLanguageCode],
/// which read the platform locale once.
library;

import 'package:flutter/widgets.dart';

const List<String> _supportedLocales = ['en', 'vi'];

/// The locale to fall back on when neither the profile nor the phone names one
/// Kallo ships.
const String kDefaultLocale = 'en';

/// Always offered, wherever the phone thinks it is — a Vietnamese cook abroad
/// still cooks Vietnamese.
const String kPinnedOriginCountry = 'Vietnam';

/// Extra suggestions per app language, in the order they should appear under
/// the device region and [kPinnedOriginCountry]. `vi` adds none — a Vietnamese
/// speaker's answer is already in the first two rows.
const Map<String, List<String>> kLanguageOriginSuggestions = {
  'en': ['United States', 'Australia', 'United Kingdom'],
  'vi': <String>[],
};

/// The phone's region as an uppercase ISO 3166-1 alpha-2 code, or `null` when
/// the platform reports no country (a bare `en` locale, for instance).
String? deviceRegionCode() {
  final code =
      WidgetsBinding.instance.platformDispatcher.locale.countryCode?.trim();
  if (code == null || code.isEmpty) return null;
  return code.toUpperCase();
}

/// The phone's language narrowed to a locale Kallo ships (`en` or `vi`),
/// falling back to `en`.
String deviceLanguageCode() {
  final language =
      WidgetsBinding.instance.platformDispatcher.locale.languageCode
          .toLowerCase();
  return _supportedLocales.contains(language) ? language : kDefaultLocale;
}

/// The country VALUES to show above the A–Z list, in order: the device region
/// first (when Kallo lists it), then Vietnam, then the language's suggestions.
/// Never repeats a value.
List<String> suggestedOriginCountries({
  required String? regionCountryValue,
  required String languageCode,
}) {
  final suggestions = <String>[];
  void add(String? value) {
    if (value == null || value.isEmpty) return;
    if (suggestions.contains(value)) return;
    suggestions.add(value);
  }

  add(regionCountryValue);
  add(kPinnedOriginCountry);
  for (final value in kLanguageOriginSuggestions[languageCode] ?? const []) {
    add(value);
  }
  return suggestions;
}

/// [value] if it is a locale Kallo ships, else `null` — so a caller can chain
/// its candidates with `??` and land on [kDefaultLocale].
String? supportedLocaleOrNull(String? value) {
  if (value == null) return null;
  return _supportedLocales.contains(value) ? value : null;
}

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/logic/region_defaults.dart';

/// The rows above the A–Z list: the device region first (when Kallo lists it),
/// then Vietnam, then the app language's own suggestions — never repeating a
/// value.
const _cases = [
  (
    name: 'en + AU: region first, then Vietnam, then the en list minus AU',
    region: 'Australia',
    language: 'en',
    expected: ['Australia', 'Vietnam', 'United States', 'United Kingdom'],
  ),
  (
    name: 'en + VN: Vietnam is not listed twice',
    region: 'Vietnam',
    language: 'en',
    expected: ['Vietnam', 'United States', 'Australia', 'United Kingdom'],
  ),
  (
    name: 'vi + VN: Vietnam alone',
    region: 'Vietnam',
    language: 'vi',
    expected: ['Vietnam'],
  ),
  (
    name: 'vi + US: the region, then Vietnam, and nothing else',
    region: 'United States',
    language: 'vi',
    expected: ['United States', 'Vietnam'],
  ),
  (
    name: 'null region, en: Vietnam leads the language list',
    region: null,
    language: 'en',
    expected: ['Vietnam', 'United States', 'Australia', 'United Kingdom'],
  ),
  (
    name: 'null region, vi: Vietnam alone',
    region: null,
    language: 'vi',
    expected: ['Vietnam'],
  ),
  (
    name: 'an unshipped language falls back to Vietnam only',
    region: null,
    language: 'fr',
    expected: ['Vietnam'],
  ),
];

void main() {
  group('suggestedOriginCountries', () {
    for (final c in _cases) {
      test(c.name, () {
        expect(
          suggestedOriginCountries(
            regionCountryValue: c.region,
            languageCode: c.language,
          ),
          c.expected,
        );
      });
    }
  });
}

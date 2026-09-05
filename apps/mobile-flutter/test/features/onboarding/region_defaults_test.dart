import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/logic/region_defaults.dart';

void main() {
  group('suggestedOriginCountries', () {
    test('en + AU: region first, then Vietnam, then the en list minus AU', () {
      expect(
        suggestedOriginCountries(
          regionCountryValue: 'Australia',
          languageCode: 'en',
        ),
        ['Australia', 'Vietnam', 'United States', 'United Kingdom'],
      );
    });

    test('en + VN: Vietnam is not listed twice', () {
      expect(
        suggestedOriginCountries(
          regionCountryValue: 'Vietnam',
          languageCode: 'en',
        ),
        ['Vietnam', 'United States', 'Australia', 'United Kingdom'],
      );
    });

    test('vi + VN: Vietnam alone', () {
      expect(
        suggestedOriginCountries(
          regionCountryValue: 'Vietnam',
          languageCode: 'vi',
        ),
        ['Vietnam'],
      );
    });

    test('vi + US: the region, then Vietnam, and nothing else', () {
      expect(
        suggestedOriginCountries(
          regionCountryValue: 'United States',
          languageCode: 'vi',
        ),
        ['United States', 'Vietnam'],
      );
    });

    test('null region: Vietnam leads the language list', () {
      expect(
        suggestedOriginCountries(
          regionCountryValue: null,
          languageCode: 'en',
        ),
        ['Vietnam', 'United States', 'Australia', 'United Kingdom'],
      );
      expect(
        suggestedOriginCountries(
          regionCountryValue: null,
          languageCode: 'vi',
        ),
        ['Vietnam'],
      );
    });

    test('an unshipped language falls back to Vietnam only', () {
      expect(
        suggestedOriginCountries(
          regionCountryValue: null,
          languageCode: 'fr',
        ),
        ['Vietnam'],
      );
    });
  });
}

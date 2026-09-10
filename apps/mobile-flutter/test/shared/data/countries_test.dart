import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/data/countries.dart';

void main() {
  group('kCountries codes', () {
    test('every entry carries a 2-letter uppercase ISO code', () {
      for (final country in kCountries) {
        expect(
          country.code,
          matches(RegExp(r'^[A-Z]{2}$')),
          reason: '${country.value} has code "${country.code}"',
        );
      }
    });

    test('codes are unique', () {
      final codes = kCountries.map((c) => c.code).toList();
      expect(codes.toSet().length, codes.length);
    });

    test('values are unique', () {
      final values = kCountries.map((c) => c.value).toList();
      expect(values.toSet().length, values.length);
    });
  });

  group('countryForCode', () {
    test('is case-insensitive', () {
      expect(countryForCode('vn')?.value, 'Vietnam');
      expect(countryForCode('VN')?.value, 'Vietnam');
    });

    test('resolves AU to Australia', () {
      expect(countryForCode('AU')?.value, 'Australia');
    });

    test('returns null for a region Kallo does not list', () {
      expect(countryForCode('ZZ'), isNull);
      expect(countryForCode(''), isNull);
    });
  });

  group('countryForValue', () {
    test('resolves the stored English short name', () {
      expect(countryForValue('United States')?.code, 'US');
      expect(countryForValue('Vietnam')?.vi, 'Việt Nam');
    });

    test('returns null for an unknown value', () {
      expect(countryForValue('Atlantis'), isNull);
    });
  });
}

import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/logic/display_format.dart';

/// `capitalizeFirst` runs on every rendered meal name, and meal names arrive
/// from two very different places: the composer, where a person types
/// "phở bò" in lower case, and the barcode/OCR path, where the product carries
/// the brand's own casing ("belVita", "iPro"). The first wants a capital; the
/// second must survive untouched, which is what the first-word test buys.
///
/// Mirrors `lib/core/text/__tests__/capitalize.test.ts` on web — the two
/// implementations are kept in sync, so the cases are too.
void main() {
  group('capitalizeFirst', () {
    test('capitalizes a lower-case composer name', () {
      expect(capitalizeFirst('phở bò'), 'Phở bò');
    });

    test('capitalizes a diacritic first character without splitting it', () {
      expect(capitalizeFirst('gạo tẻ'), 'Gạo tẻ');
    });

    test('leaves a brand name whose first word is mixed-case alone', () {
      expect(capitalizeFirst('belVita cookies'), 'belVita cookies');
      expect(capitalizeFirst('iPro shake'), 'iPro shake');
    });

    test('leaves a name starting with a digit alone', () {
      expect(capitalizeFirst('120g gạo'), '120g gạo');
    });

    test('leaves a name starting with an emoji alone', () {
      expect(capitalizeFirst('🍜 bún'), '🍜 bún');
    });

    test('passes an empty string straight through', () {
      expect(capitalizeFirst(''), '');
    });
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/logic/barcode_amount.dart';
import 'package:nham_mobile/models/barcode_product.dart';

const fullProduct = BarcodeProduct(
  barcode: '8934563138162',
  name: 'Hảo Hảo',
  brand: 'Acecook',
  caloriesKcal: 350,
  proteinG: 7.5,
  carbohydrateG: 52,
  fatG: 12,
  servingSizeG: 75,
  packageSizeG: 150,
);

const bareProduct = BarcodeProduct(
  barcode: '123',
  name: 'Mystery snack',
  brand: null,
  caloriesKcal: 500,
);

void main() {
  group('availableModes', () {
    test('offers serving, package, grams in priority order when sized', () {
      expect(availableModes(fullProduct), [
        BarcodeAmountMode.serving,
        BarcodeAmountMode.package,
        BarcodeAmountMode.grams,
      ]);
    });

    test('always falls back to grams alone', () {
      expect(availableModes(bareProduct), [BarcodeAmountMode.grams]);
    });

    test('skips only the missing sizing', () {
      const servingOnly = BarcodeProduct(
        barcode: '1',
        name: 'x',
        brand: null,
        servingSizeG: 30,
      );
      expect(availableModes(servingOnly), [
        BarcodeAmountMode.serving,
        BarcodeAmountMode.grams,
      ]);
    });
  });

  group('clampGrams', () {
    test('clamps into [1, 100000] and rounds', () {
      expect(clampGrams(0), 1);
      expect(clampGrams(-50), 1);
      expect(clampGrams(74.6), 75);
      expect(clampGrams(200000), maxFoodItemGrams);
    });
  });

  group('defaultCustomGrams', () {
    test('prefers serving, then package, then 100', () {
      expect(defaultCustomGrams(fullProduct), 75);
      const packageOnly = BarcodeProduct(
        barcode: '1',
        name: 'x',
        brand: null,
        packageSizeG: 250,
      );
      expect(defaultCustomGrams(packageOnly), 250);
      expect(defaultCustomGrams(bareProduct), 100);
    });
  });

  group('resolveGrams', () {
    test('serving mode multiplies and rounds', () {
      expect(
        resolveGrams(
          mode: BarcodeAmountMode.serving,
          servings: 3,
          customGrams: 100,
          product: fullProduct,
        ),
        225,
      );
    });

    test('serving mode caps at the shared 100kg limit', () {
      const huge = BarcodeProduct(
        barcode: '1',
        name: 'x',
        brand: null,
        servingSizeG: 90000,
      );
      expect(
        resolveGrams(
          mode: BarcodeAmountMode.serving,
          servings: 99,
          customGrams: 100,
          product: huge,
        ),
        maxFoodItemGrams,
      );
    });

    test('package mode uses the whole package', () {
      expect(
        resolveGrams(
          mode: BarcodeAmountMode.package,
          servings: 1,
          customGrams: 100,
          product: fullProduct,
        ),
        150,
      );
    });

    test('grams mode uses custom grams, clamped up from zero', () {
      expect(
        resolveGrams(
          mode: BarcodeAmountMode.grams,
          servings: 1,
          customGrams: 0,
          product: fullProduct,
        ),
        1,
      );
    });

    test('serving mode without sizing falls through to custom grams', () {
      expect(
        resolveGrams(
          mode: BarcodeAmountMode.serving,
          servings: 5,
          customGrams: 80,
          product: bareProduct,
        ),
        80,
      );
    });
  });

  group('scalePer100', () {
    test('calories round to whole numbers', () {
      expect(scalePer100(350, 75, decimals: 0), 263); // 262.5 → 263
    });

    test('macros round to one decimal', () {
      expect(scalePer100(7.5, 75), 5.6); // 5.625 → 5.6
    });

    test('null passes through — unknown is not zero', () {
      expect(scalePer100(null, 200), isNull);
    });
  });

  group('BarcodeProduct.fromJson', () {
    test('tolerates missing and integer-typed fields', () {
      final product = BarcodeProduct.fromJson(const {
        'barcode': '123',
        'name': 'Snack',
        'caloriesKcal': 500,
        'servingSizeG': 30.5,
      });
      expect(product.brand, isNull);
      expect(product.caloriesKcal, 500.0);
      expect(product.servingSizeG, 30.5);
      expect(product.proteinG, isNull);
      expect(product.packageSizeG, isNull);
    });
  });
}

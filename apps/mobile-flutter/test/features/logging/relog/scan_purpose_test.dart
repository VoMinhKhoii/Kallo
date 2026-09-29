import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/relog/scan_purpose.dart';
import 'package:kallo_mobile/models/nutrition/barcode_product.dart';

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
  group('barcodePickLabel', () {
    test('leads with the brand, so the sentence names the package', () {
      expect(barcodePickLabel(fullProduct, 75), 'Acecook Hảo Hảo (75g)');
    });

    test('falls back to the bare name when there is no brand', () {
      expect(barcodePickLabel(bareProduct, 100), 'Mystery snack (100g)');
    });

    test('keeps a part serving as printed, a whole one without ".0"', () {
      expect(barcodePickLabel(bareProduct, 12.5), 'Mystery snack (12.5g)');
      expect(barcodePickLabel(bareProduct, 100.0), 'Mystery snack (100g)');
    });

    test('says a drink in millilitres', () {
      const milk = BarcodeProduct(
        barcode: '8935217400058',
        name: 'Sữa tươi',
        brand: 'TH true milk',
        amountUnit: 'ml',
      );
      expect(barcodePickLabel(milk, 180), 'TH true milk Sữa tươi (180ml)');
    });

    // Two packages, one name: without the brand both picks read as the same
    // words, so the sentence cannot say which was scanned — and neither can
    // `reconcileMentions`, which locates a pick BY those words.
    test('tells two same-named products from different brands apart', () {
      const th = BarcodeProduct(
        barcode: '8935001',
        name: 'Sữa tươi',
        brand: 'TH true milk',
      );
      const vinamilk = BarcodeProduct(
        barcode: '8934673',
        name: 'Sữa tươi',
        brand: 'Vinamilk',
      );
      expect(barcodePickLabel(th, 180), isNot(barcodePickLabel(vinamilk, 180)));
    });

    // Seen on device: a scanned Vinamilk yogurt logged as
    // "Vinamilk Vinamilk Sữa chua ít đường (100g)".
    group('a name that already carries its brand', () {
      BarcodeProduct product(String name, String? brand) =>
          BarcodeProduct(barcode: '8934673', name: name, brand: brand);

      test('does not print the brand twice', () {
        expect(
          barcodePickLabel(
            product('Vinamilk Sữa chua ít đường', 'Vinamilk'),
            100,
          ),
          'Vinamilk Sữa chua ít đường (100g)',
        );
      });

      test('matches the brand case-insensitively and trimmed', () {
        expect(
          barcodePickLabel(product('VINAMILK Sữa chua', ' Vinamilk '), 100),
          'VINAMILK Sữa chua (100g)',
        );
      });

      test('compares Vietnamese diacritics as they are', () {
        expect(
          barcodePickLabel(product('Bò Cười phô mai', 'Bò Cười'), 20),
          'Bò Cười phô mai (20g)',
        );
        // "Bo Cuoi" is not "Bò Cười": the brand is still said.
        expect(
          barcodePickLabel(product('Bò Cười phô mai', 'Bo Cuoi'), 20),
          'Bo Cuoi Bò Cười phô mai (20g)',
        );
      });

      test('prepends a brand the name does not carry', () {
        expect(
          barcodePickLabel(product('Sữa chua ít đường', 'Vinamilk'), 100),
          'Vinamilk Sữa chua ít đường (100g)',
        );
      });

      test('keeps the bare name when there is no brand', () {
        expect(
          barcodePickLabel(product('Sữa chua ít đường', null), 100),
          'Sữa chua ít đường (100g)',
        );
      });

      test(
        'still prepends a brand that is only a prefix of the first word',
        () {
          expect(
            barcodePickLabel(product('Vinamilk Sữa chua', 'Vina'), 100),
            'Vina Vinamilk Sữa chua (100g)',
          );
        },
      );
    });
  });
}

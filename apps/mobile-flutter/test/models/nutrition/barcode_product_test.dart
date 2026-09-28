import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/models/nutrition/barcode_product.dart';

void main() {
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

    test('reads an older server with no unit, photo or micros as grams', () {
      final product = BarcodeProduct.fromJson(const {
        'barcode': '123',
        'name': 'Snack',
      });
      expect(product.amountUnit, 'g');
      expect(product.imageUrl, isNull);
      expect(product.micronutrients, isNull);
    });

    test('reads the unit, the photo path and the micronutrients', () {
      final product = BarcodeProduct.fromJson(const {
        'barcode': '8938507849131',
        'name': 'Coconut Water',
        'amountUnit': 'ml',
        'imageUrl': '/api/v1/barcode/image/8938507849131',
        'micronutrients': {'calciumMg': 10, 'potassiumMg': 170.5},
      });
      expect(product.amountUnit, 'ml');
      expect(product.imageUrl, '/api/v1/barcode/image/8938507849131');
      expect(product.micronutrients, {'calciumMg': 10.0, 'potassiumMg': 170.5});
    });

    test('keeps a Premium-stripped response distinguishable from none', () {
      final stripped = BarcodeProduct.fromJson(const {
        'barcode': '1',
        'name': 'x',
        'micronutrients': null,
      });
      final empty = BarcodeProduct.fromJson(const {
        'barcode': '1',
        'name': 'x',
        'micronutrients': <String, dynamic>{},
      });
      expect(stripped.micronutrients, isNull);
      expect(empty.micronutrients, isEmpty);
    });
  });
}

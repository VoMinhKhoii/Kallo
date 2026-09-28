import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/scan/amount.dart';
import 'package:kallo_mobile/features/logging/logic/scan/food.dart';
import 'package:kallo_mobile/models/nutrition/barcode_product.dart';
import 'package:kallo_mobile/models/nutrition_label.dart';

/// The one model every scan result is: values per basis, scaled to the amount
/// being logged, with unknown kept unknown.
const _coconutWater = BarcodeProduct(
  barcode: '8938507849131',
  name: 'Coconut Water',
  brand: 'Coco Xim',
  caloriesKcal: 16,
  proteinG: 0,
  carbohydrateG: 4,
  fatG: 0,
  sodiumMg: 39,
  servingSizeG: 100,
  packageSizeG: 1000,
  amountUnit: 'ml',
  micronutrients: {'calciumMg': 10, 'potassiumMg': 170},
);

const _label = NutritionLabel(
  basis: LabelBasis.per100ml,
  confidence: LabelConfidence.high,
  labelEvidence: '',
  productName: 'Pure Coconut Water',
  per100ml: {'calories': 15, 'proteinGrams': 0, 'carbsGrams': 4, 'fatGrams': 0},
);

void main() {
  group('ScanFood', () {
    test(
      'a barcode product is per 100 of its unit, sized by serving and pack',
      () {
        final food = ScanFood.fromBarcode(_coconutWater);
        expect(food.unit, 'ml');
        expect(food.basisAmount, 100);
        expect(food.servingSize, 100);
        expect(food.packageSize, 1000);
        expect(food.values['calories'], 16);
        expect(food.values['carbsGrams'], 4);
        expect(food.values['calciumMg'], 10);
        expect(food.logsByBarcode, isTrue);
      },
    );

    test('unknown stays unknown; zero stays zero', () {
      final food = ScanFood.fromBarcode(_coconutWater);
      expect(food.values['fiberGrams'], isNull, reason: 'not listed');
      expect(food.values['proteinGrams'], 0, reason: 'listed as 0');
      final scaled = food.nutritionFor(250);
      expect(scaled['fiberGrams'], isNull);
      expect(scaled['proteinGrams'], 0);
      expect(scaled['calories'], 40);
      expect(scaled['carbsGrams'], 10);
    });

    test('an edited barcode product logs its own numbers, not the barcode', () {
      final food = ScanFood.fromBarcode(_coconutWater).copyWith(edited: true);
      expect(food.logsByBarcode, isFalse);
    });

    test('a read label keeps its printed column and name', () {
      final food = ScanFood.fromLabel(_label, fallbackName: 'Scanned food');
      expect(food.source, ScanFoodSource.label);
      expect(food.name, 'Pure Coconut Water');
      expect(food.unit, 'ml');
      expect(food.basisAmount, 100);
      expect(food.valueFor('calories', 250), 37.5);
      expect(food.logsByBarcode, isFalse);
    });

    test('Enter manually starts empty, per 100 g, and cannot save yet', () {
      final food = ScanFood.blank();
      expect(food.name, isEmpty);
      expect(food.unit, 'g');
      expect(food.values.values.every((v) => v == null), isTrue);
      expect(food.hasRequired, isFalse);
    });

    test('changing the unit drops sizes that no longer mean anything', () {
      final food = ScanFood.fromBarcode(_coconutWater).copyWith(unit: 'g');
      expect(food.servingSize, isNull);
      expect(food.packageSize, isNull);
    });
  });

  group('ScanAmount', () {
    final food = ScanFood.fromBarcode(_coconutWater);

    test('starts on one serving and offers serving, pack and custom', () {
      expect(portionsFor(food), [
        ScanPortion.serving,
        ScanPortion.pack,
        ScanPortion.custom,
      ]);
      final amount = ScanAmount.initial(food);
      expect(amount.portion, ScanPortion.serving);
      expect(amount.resolve(food), 100);
    });

    test('servings and packs count by one; custom steps by 10', () {
      var amount = ScanAmount.initial(food).stepped(food, 1);
      expect(amount.resolve(food), 200);
      amount = amount.withPortion(ScanPortion.pack, food).stepped(food, 1);
      expect(amount.resolve(food), 2000);
      amount = amount.withPortion(ScanPortion.custom, food);
      expect(
        amount.resolve(food),
        2000,
        reason: 'custom starts from on-screen',
      );
      expect(amount.stepped(food, -1).resolve(food), 1990);
    });

    test('never goes below one', () {
      final amount = ScanAmount.initial(food);
      expect(amount.canStep(food, -1), isFalse);
      final custom = amount.copyWith(portion: ScanPortion.custom, custom: 5);
      expect(custom.stepped(food, -1).resolve(food), 1);
    });

    test('a typed or ruler-picked amount stays inside the log limits', () {
      final amount = ScanAmount.initial(food);
      expect(amount.withCustom(0).resolve(food), 1);
      expect(amount.withCustom(999999).custom, maxScanAmount);
      expect(amount.withCustom(250).portion, ScanPortion.custom);
    });

    test('a count stops where the entry would pass the log limit', () {
      final bigPack = ScanFood.fromBarcode(
        const BarcodeProduct(
          barcode: '1',
          name: 'Rice',
          brand: null,
          caloriesKcal: 360,
          packageSizeG: 2000,
        ),
      );
      var amount = ScanAmount.initial(bigPack);
      expect(amount.portion, ScanPortion.pack);
      for (var i = 0; i < 80; i++) {
        amount = amount.stepped(bigPack, 1);
      }
      expect(amount.packs, 50, reason: '50 x 2 kg is the 100 kg limit');
      expect(amount.canStep(bigPack, 1), isFalse);
      expect(amount.resolve(bigPack), 100000);
    });

    test('an edit keeps the amount only while it means the same', () {
      final amount = ScanAmount.initial(food).stepped(food, 1);
      final renamed = food.copyWith(name: 'Nước dừa', edited: true);
      expect(carryAmount(amount, food, renamed), same(amount));
      final perServing = food.copyWith(unit: 'serving', basisAmount: 1);
      expect(carryAmount(amount, food, perServing), isNull);
      expect(carryAmount(null, food, renamed), isNull);
    });

    test('sizes read the way a pack prints them', () {
      expect(formatSize(100, 'ml'), '100 ml');
      expect(formatSize(1000, 'ml'), '1 L');
      expect(formatSize(1500, 'g'), '1.5 kg');
      expect(formatSize(330, 'ml'), '330 ml');
      expect(formatSize(12.5, 'g'), '12.5 g');
      expect(formatSize(2, 'serving'), '2 serving', reason: 'no L / kg');
    });

    test('a serving-only label steps whole servings, with no custom', () {
      const perServing = NutritionLabel(
        basis: LabelBasis.perServing,
        confidence: LabelConfidence.high,
        labelEvidence: '',
        perServing: {'calories': 90},
      );
      final label = ScanFood.fromLabel(perServing, fallbackName: 'x');
      expect(label.unit, 'serving');
      expect(portionsFor(label), [ScanPortion.serving]);
    });
  });
}

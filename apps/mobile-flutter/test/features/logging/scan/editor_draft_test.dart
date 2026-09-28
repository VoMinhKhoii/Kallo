import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/scan/food.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/scan/editor/draft.dart';
import 'package:kallo_mobile/models/nutrition/barcode_product.dart';

/// The rules the editor's Save waits for, and what an edit hands back: blank
/// is unknown, 0 is zero, and a new "Values per" relabels, never rescales.
void main() {
  const product = BarcodeProduct(
    barcode: '8938507849131',
    name: 'Coconut Water',
    brand: 'Coco Xim',
    caloriesKcal: 16,
    proteinG: 0,
    carbohydrateG: 4,
    fatG: 0,
    servingSizeG: 100,
    packageSizeG: 1000,
    amountUnit: 'ml',
  );

  ScanEditorDraft draftOf(ScanFood food) {
    final draft = ScanEditorDraft(food);
    addTearDown(draft.dispose);
    return draft;
  }

  void fill(ScanEditorDraft d) {
    d.name.text = 'Chè bắp';
    d.fields['calories']!.text = '250';
    d.fields['proteinGrams']!.text = '10';
    d.fields['carbsGrams']!.text = '30';
    d.fields['fatGrams']!.text = '8';
  }

  test('seeds from the food: known values as typed, unknown blank', () {
    final d = draftOf(ScanFood.fromBarcode(product));
    expect(d.name.text, 'Coconut Water');
    expect(d.fields['calories']!.text, '16');
    expect(d.fields['proteinGrams']!.text, '0', reason: '0 is a value');
    expect(d.fields['fiberGrams']!.text, isEmpty, reason: 'unknown');
    expect(d.basis, (amount: 100.0, unit: 'ml'));
    expect(d.isValid, isTrue);
  });

  test('Save waits for a name and the four the log requires', () {
    final d = draftOf(ScanFood.blank());
    expect(d.isValid, isFalse);
    fill(d);
    expect(d.isValid, isTrue);

    d.fields['fatGrams']!.text = '';
    expect(d.isValid, isFalse, reason: 'fat unknown');
    d.fields['fatGrams']!.text = '0';
    expect(d.isValid, isTrue, reason: 'fat zero');

    d.name.text = '   ';
    expect(d.isValid, isFalse, reason: 'a blank name');
    d.name.text = 'x' * 201;
    expect(d.isValid, isFalse, reason: "past the server's 200");
  });

  test('a malformed or out-of-range value flags its field and blocks Save', () {
    final d = draftOf(ScanFood.blank());
    fill(d);
    for (final bad in ['1e3', '-5', 'abc', 'Infinity']) {
      d.fields['sodiumMg']!.text = bad;
      expect(d.hasError('sodiumMg'), isTrue, reason: bad);
      expect(d.isValid, isFalse, reason: bad);
    }
    d.fields['sodiumMg']!.text = '12,5';
    expect(d.hasError('sodiumMg'), isFalse, reason: 'a comma decimal');

    d.fields['calories']!.text = '20001';
    expect(d.hasError('calories'), isTrue, reason: 'above the ceiling');
    d.fields['sodiumMg']!.text = '';
    expect(d.hasError('sodiumMg'), isFalse, reason: 'blank is no error');
  });

  test('hands back blank as unknown and 0 as zero', () {
    final d = draftOf(ScanFood.blank());
    fill(d);
    d.fields['sodiumMg']!.text = '0';
    final food = d.toFood();
    expect(food.name, 'Chè bắp');
    expect(food.values['sodiumMg'], 0);
    expect(food.values['fiberGrams'], isNull);
    expect(food.edited, isTrue);
  });

  test('a new basis relabels the values, never rescales them', () {
    final d = draftOf(ScanFood.fromBarcode(product));
    d.basis = (amount: 1.0, unit: 'serving');
    final food = d.toFood();
    expect(food.unit, 'serving');
    expect(food.basisAmount, 1);
    expect(food.values['calories'], 16, reason: 'what was typed, per serving');
    expect(food.servingSize, isNull, reason: 'ml sizes mean nothing now');
    expect(food.logsByBarcode, isFalse, reason: 'edited: its own numbers');
  });

  test("offers 100 g, 100 ml and a serving, plus the source's own once", () {
    expect(draftOf(ScanFood.blank()).bases, [
      (amount: 100.0, unit: 'g'),
      (amount: 100.0, unit: 'ml'),
      (amount: 1.0, unit: 'serving'),
    ]);
    final perCan = ScanFood.blank().copyWith(basisAmount: 330, unit: 'ml');
    expect(draftOf(perCan).bases.last, (amount: 330.0, unit: 'ml'));
  });

  group('the fourth required figure', () {
    String text(ScanEditorDraft d, String key) => d.fields[key]!.text;

    test('fills itself once three are typed, and keeps in step', () {
      final d = draftOf(ScanFood.blank());
      d.fields['calories']!.text = '250';
      d.fields['proteinGrams']!.text = '10';
      expect(text(d, 'fatGrams'), isEmpty, reason: 'two are not enough');

      d.fields['carbsGrams']!.text = '30';
      expect(text(d, 'fatGrams'), '10', reason: '(250 - 40 - 120) / 9');
      expect(d.filledKey, 'fatGrams');

      d.fields['carbsGrams']!.text = '21';
      expect(text(d, 'fatGrams'), '14', reason: 'follows the three');

      d.fields['carbsGrams']!.text = '';
      expect(text(d, 'fatGrams'), isEmpty, reason: 'nothing supports it now');
      expect(d.filledKey, isNull);
    });

    test('whichever one is left, calories too', () {
      final d = draftOf(ScanFood.blank());
      d.fields['fatGrams']!.text = '10';
      d.fields['proteinGrams']!.text = '10';
      d.fields['carbsGrams']!.text = '30';
      expect(text(d, 'calories'), '250');
    });

    test('never over a field the user typed in, even one they cleared', () {
      final d = draftOf(ScanFood.blank());
      d.fields['calories']!.text = '250';
      d.fields['proteinGrams']!.text = '10';
      d.fields['carbsGrams']!.text = '30';
      d.fields['fatGrams']!.text = '8';
      expect(d.filledKey, isNull, reason: 'typed over: theirs now');

      d.fields['fatGrams']!.text = '';
      expect(text(d, 'fatGrams'), isEmpty, reason: 'cleared on purpose');
      expect(d.isValid, isFalse);
    });

    test('a caret move in the filled field does not take it over', () {
      final d = draftOf(ScanFood.blank());
      d.fields['calories']!.text = '250';
      d.fields['proteinGrams']!.text = '10';
      d.fields['carbsGrams']!.text = '30';
      d.fields['fatGrams']!.selection = const TextSelection(
        baseOffset: 0,
        extentOffset: 2,
      );
      expect(d.filledKey, 'fatGrams');
    });

    test('a label missing one comes in with it filled', () {
      final d = draftOf(
        ScanFood.fromBarcode(product).copyWith(
          values: {...ScanFood.fromBarcode(product).values, 'fatGrams': null},
        ),
      );
      expect(text(d, 'fatGrams'), '0', reason: '(16 - 0 - 16) / 9');
      expect(d.filledKey, 'fatGrams');
      expect(d.isValid, isTrue);
    });

    test('nothing when the three cannot add up, or one is malformed', () {
      final d = draftOf(ScanFood.blank());
      d.fields['calories']!.text = '100';
      d.fields['proteinGrams']!.text = '10';
      d.fields['carbsGrams']!.text = '30';
      expect(text(d, 'fatGrams'), isEmpty, reason: '160 kcal > 100');

      d.fields['calories']!.text = '250';
      expect(text(d, 'fatGrams'), '10');
      d.fields['calories']!.text = '1e3';
      expect(text(d, 'fatGrams'), isEmpty);
    });
  });

  test('says why a figure cannot be saved; an unfinished decimal can', () {
    final d = draftOf(ScanFood.blank());
    d.fields['sodiumMg']!.text = 'abc';
    expect(d.issueOf('sodiumMg'), ScanFieldIssue.notANumber);
    d.fields['sodiumMg']!.text = '50001';
    expect(d.issueOf('sodiumMg'), ScanFieldIssue.tooHigh);
    d.fields['sodiumMg']!.text = '12,';
    expect(d.issueOf('sodiumMg'), isNull, reason: 'still being typed');
    expect(d.valueOf('sodiumMg'), 12);

    fill(d);
    for (final lone in ['.', ',']) {
      d.fields['sodiumMg']!.text = lone;
      expect(d.issueOf('sodiumMg'), ScanFieldIssue.notANumber, reason: lone);
      expect(d.isValid, isFalse, reason: 'not saved as blank: $lone');
    }
  });
}

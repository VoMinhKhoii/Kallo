import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/logic/label_review.dart';
import 'package:nham_mobile/models/nutrition_label.dart';

Map<String, dynamic> labelJson({
  required String basis,
  Map<String, dynamic>? column,
  String columnKey = 'per100g',
  Map<String, dynamic>? servingSize,
  Map<String, dynamic>? netContent,
  num? servingsPerContainer,
  String? productName,
  Map<String, dynamic>? extraColumn,
  String? extraColumnKey,
}) => {
  'basis': basis,
  'confidence': 'high',
  'labelEvidence': 'Thông tin dinh dưỡng',
  'productName': productName,
  'servingSize': servingSize,
  'servingSizeDescription': null,
  'servingsPerContainer': servingsPerContainer,
  if (netContent != null) 'netContent': netContent,
  columnKey: column ?? const {'calories': 480, 'proteinGrams': 6},
  if (extraColumnKey != null) extraColumnKey: extraColumn ?? const {},
};

NutritionLabel parse(Map<String, dynamic> json) =>
    NutritionLabel.fromJson(json);

void main() {
  group('parseLabelDecimal', () {
    test('accepts plain and comma decimals', () {
      expect(parseLabelDecimal('1.5'), 1.5);
      expect(parseLabelDecimal('1,5'), 1.5);
      expect(parseLabelDecimal(' 12 '), 12);
      expect(parseLabelDecimal('0'), 0);
    });

    test('rejects anything that is not a plain positive decimal', () {
      expect(parseLabelDecimal(''), isNull);
      expect(parseLabelDecimal('-5'), isNull);
      expect(parseLabelDecimal('1e3'), isNull);
      expect(parseLabelDecimal('Infinity'), isNull);
      expect(parseLabelDecimal('1.2.3'), isNull);
      expect(parseLabelDecimal('abc'), isNull);
    });
  });

  group('formatLabelNumber', () {
    test('drops the trailing .0 the way JS String() does', () {
      expect(formatLabelNumber(100), '100');
      expect(formatLabelNumber(1200), '1200');
      expect(formatLabelNumber(1.5), '1.5');
      expect(formatLabelNumber(12.50), '12.5');
    });

    test('rounds to two decimals', () {
      expect(formatLabelNumber(33.333333), '33.33');
      expect(formatLabelNumber(1.005), '1');
    });
  });

  group('reviewColumnFor', () {
    test('per_100g reads the per-100g column at 100 g', () {
      final column = reviewColumnFor(parse(labelJson(basis: 'per_100g')));
      expect(column.referenceAmount, 100);
      expect(column.unit, 'g');
      expect(column.values['calories'], 480);
    });

    test('per_100ml reads the per-100ml column at 100 ml', () {
      final column = reviewColumnFor(
        parse(labelJson(basis: 'per_100ml', columnKey: 'per100ml')),
      );
      expect(column.referenceAmount, 100);
      expect(column.unit, 'ml');
    });

    test('per_container reads net content as the amount', () {
      final column = reviewColumnFor(
        parse(
          labelJson(
            basis: 'per_container',
            columnKey: 'perContainer',
            netContent: {'value': 330, 'unit': 'ml'},
            servingsPerContainer: 2,
          ),
        ),
      );
      expect(column.referenceAmount, 330);
      expect(column.unit, 'ml');
    });

    test('per_serving with a stated serving size uses it', () {
      final column = reviewColumnFor(
        parse(
          labelJson(
            basis: 'per_serving',
            columnKey: 'perServing',
            servingSize: {'value': 75, 'unit': 'g'},
          ),
        ),
      );
      expect(column.referenceAmount, 75);
      expect(column.unit, 'g');
    });

    test('per_serving without a serving size falls back to 1 serving', () {
      final column = reviewColumnFor(
        parse(labelJson(basis: 'per_serving', columnKey: 'perServing')),
      );
      expect(column.referenceAmount, 1);
      expect(column.unit, 'serving');
    });

    test('a dual-column label edits the per-serving column', () {
      final column = reviewColumnFor(
        parse(
          labelJson(
            basis: 'per_100g_and_serving',
            column: const {'calories': 480},
            servingSize: {'value': 30, 'unit': 'g'},
            extraColumnKey: 'perServing',
            extraColumn: const {'calories': 144},
          ),
        ),
      );
      expect(column.referenceAmount, 30);
      expect(column.unit, 'g');
      expect(column.values['calories'], 144);
    });

    test('a null label yields an empty serving column', () {
      final column = reviewColumnFor(null);
      expect(column.referenceAmount, 1);
      expect(column.unit, 'serving');
      expect(column.values['calories'], isNull);
      expect(column.values.length, labelNutrientKeys.length);
    });
  });

  group('shortcutsFor', () {
    test('offers the serving and the whole package when both are known', () {
      final label = parse(
        labelJson(
          basis: 'per_serving',
          columnKey: 'perServing',
          servingSize: {'value': 30, 'unit': 'g'},
          servingsPerContainer: 5,
        ),
      );
      final shortcuts = shortcutsFor(label, 'g');
      expect(shortcuts.servingAmount, 30);
      expect(shortcuts.packageAmount, 150);
    });

    test('uses net content for the package on a per-container label', () {
      final label = parse(
        labelJson(
          basis: 'per_container',
          columnKey: 'perContainer',
          netContent: {'value': 330, 'unit': 'ml'},
          servingsPerContainer: 1,
        ),
      );
      expect(shortcutsFor(label, 'ml').packageAmount, 330);
    });

    test('offers no package when servings per container is unknown', () {
      final label = parse(
        labelJson(
          basis: 'per_serving',
          columnKey: 'perServing',
          servingSize: {'value': 30, 'unit': 'g'},
        ),
      );
      expect(shortcutsFor(label, 'g').packageAmount, isNull);
    });
  });

  group('LabelReviewState', () {
    LabelReviewState per100gState() => LabelReviewState(
      parse(
        labelJson(
          basis: 'per_100g',
          column: const {
            'calories': 480,
            'proteinGrams': 6,
            'carbsGrams': 62,
            'fatGrams': 22,
            'sodiumMg': 320,
          },
        ),
      ),
      defaultProductName: 'Scanned packaged food',
    );

    test('seeds from the label column', () {
      final state = per100gState();
      expect(state.amountText, '100');
      expect(state.unit, 'g');
      expect(state.nutrientText('calories'), '480');
      expect(state.nutrientText('ironMg'), '');
      expect(state.canConfirm, isTrue);
    });

    test('falls back to the default product name', () {
      expect(per100gState().productName, 'Scanned packaged food');
      final named = LabelReviewState(
        parse(labelJson(basis: 'per_100g', productName: '  Cosy  ')),
        defaultProductName: 'Scanned packaged food',
      );
      expect(named.productName, 'Cosy');
    });

    test('scales submitted values by a pending amount without retyping', () {
      final state = per100gState();
      state.amountText = '50';

      // Texts still show the printed figures; the submitted values are scaled.
      expect(state.nutrientText('calories'), '480');
      expect(state.nutrientValue('calories'), 240);
      expect(state.nutrientValue('proteinGrams'), 3);
      expect(state.nutrientValue('ironMg'), isNull);
    });

    test('commitAmount rewrites the texts and does not double-scale', () {
      final state = per100gState();
      state.commitAmount('50');

      expect(state.amountText, '50');
      expect(state.nutrientText('calories'), '240');
      expect(state.nutrientValue('calories'), 240);

      // Committing the same amount again is a no-op, not another halving.
      state.commitAmount('50');
      expect(state.nutrientText('calories'), '240');

      state.commitAmount('200');
      expect(state.nutrientText('calories'), '960');
    });

    test('commitAmount ignores invalid input and keeps the values', () {
      final state = per100gState();
      state.commitAmount('0');
      state.commitAmount('abc');
      state.commitAmount('100001');

      expect(state.amountText, '100');
      expect(state.nutrientText('calories'), '480');
    });

    test('preserves nulls through a rescale — unknown is not zero', () {
      final state = per100gState();
      state.commitAmount('250');
      expect(state.nutrientText('ironMg'), '');
      expect(state.nutrition['ironMg'], isNull);
      expect(state.nutrition['sodiumMg'], 800);
    });

    test('blocks confirm without all four required macros', () {
      final state = per100gState();
      state.setNutrientText('proteinGrams', '');
      expect(state.canConfirm, isFalse);

      state.setNutrientText('proteinGrams', '6');
      expect(state.canConfirm, isTrue);
    });

    test('blocks confirm on an unparseable or out-of-range nutrient', () {
      final state = per100gState();
      state.setNutrientText('sodiumMg', 'a lot');
      expect(state.nutrientHasError('sodiumMg'), isTrue);
      expect(state.canConfirm, isFalse);

      // 50,000 mg is the schema ceiling for sodium.
      state.setNutrientText('sodiumMg', '60000');
      expect(state.nutrientHasError('sodiumMg'), isTrue);

      state.setNutrientText('sodiumMg', '320');
      expect(state.nutrientHasError('sodiumMg'), isFalse);
      expect(state.canConfirm, isTrue);
    });

    test('blocks confirm on an invalid amount or product name', () {
      final state = per100gState();
      state.amountText = '0';
      expect(state.canConfirm, isFalse);

      state.amountText = '100';
      state.productName = '   ';
      expect(state.canConfirm, isFalse);

      state.productName = 'x' * 201;
      expect(state.canConfirm, isFalse);
    });
  });
}

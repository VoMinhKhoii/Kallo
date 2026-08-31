import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/logic/macro_composition.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/meal_block.dart';

Widget _wrap(MealBlock block) => MaterialApp(
  home: Scaffold(body: SizedBox(width: 358, child: block)),
);

void main() {
  final composition = compositionFromGrams((
    protein: 30,
    carbohydrate: 50,
    fat: 12,
  ));

  testWidgets('renders title, macro legend and kcal on the title row', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        MealBlock(
          title: 'phở bò tái',
          segments: composition.segments,
          gramLabels: const {
            'protein': 'P 30g',
            'carbohydrate': 'C 50g',
            'fat': 'F 12g',
          },
          kcalLabel: '480 kcal',
        ),
      ),
    );

    expect(find.text('phở bò tái'), findsOneWidget);
    for (final label in ['P 30g', 'C 50g', 'F 12g']) {
      expect(find.text(label), findsOneWidget);
    }
    final kcal = tester.getRect(find.text('480 kcal'));
    final title = tester.getRect(find.text('phở bò tái'));
    expect(kcal.center.dy, closeTo(title.center.dy, title.height),
        reason: 'titleRight placement keeps kcal on the title line');
  });

  testWidgets('a meal missing macros still shows the ones it has', (
    tester,
  ) async {
    final partial = compositionFromGrams((
      protein: 30,
      carbohydrate: null,
      fat: null,
    ));
    await tester.pumpWidget(
      _wrap(
        MealBlock(
          title: 'protein shake',
          segments: partial.segments,
          gramLabels: const {'protein': 'P 30g'},
          kcalLabel: '120 kcal',
          kcalPlacement: MealBlockKcal.legendTrailing,
        ),
      ),
    );

    expect(find.text('P 30g'), findsOneWidget);
    expect(find.text('120 kcal'), findsOneWidget);
  });

  testWidgets('an all-null meal renders without crashing', (tester) async {
    final empty = compositionFromGrams((
      protein: null,
      carbohydrate: null,
      fat: null,
    ));
    await tester.pumpWidget(
      _wrap(
        MealBlock(
          title: 'mystery meal',
          segments: empty.segments,
          gramLabels: const {},
        ),
      ),
    );
    expect(find.text('mystery meal'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('legendLeading spreads kcal and macros across the row', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        MealBlock(
          title: 'circle post',
          segments: composition.segments,
          gramLabels: const {
            'protein': 'P 30g',
            'carbohydrate': 'C 50g',
            'fat': 'F 12g',
          },
          kcalLabel: '480 kcal',
          kcalPlacement: MealBlockKcal.legendLeading,
        ),
      ),
    );

    final kcal = tester.getRect(find.text('480 kcal'));
    final fat = tester.getRect(find.text('F 12g'));
    expect(kcal.left, lessThan(fat.left),
        reason: 'kcal leads the legend on Circle posts');
  });
}

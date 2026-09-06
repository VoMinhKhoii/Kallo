import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/logic/macro_composition.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/meal_block.dart';

import '../../../app_fonts.dart';

Widget _wrap(MealBlock block) => MaterialApp(
  home: Scaffold(body: SizedBox(width: 358, child: block)),
);

void main() {
  // The legend row is width-critical — three icon+figure pairs and a kcal
  // total on one 358pt line — and a RenderFlex overflow fails these tests by
  // itself. Without the real typeface every glyph is one em wide, which
  // inflates the row past 358 and reports an overflow the app does not have.
  // See `app_fonts.dart`.
  setUpAll(loadAppFonts);

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

  testWidgets('the legend spaces its entries evenly, kcal included',
      (tester) async {
    // The old rule clustered P/C/F at the left on fixed 14pt gaps and shoved
    // kcal to the right with a Spacer, so the same legend read differently on
    // a Circle post and on the Log card. One distribution now, everywhere.
    await tester.pumpWidget(
      _wrap(
        MealBlock(
          title: 'even legend',
          segments: composition.segments,
          gramLabels: const {
            'protein': 'P 30g',
            'carbohydrate': 'C 50g',
            'fat': 'F 12g',
          },
          kcalLabel: '480 kcal',
          kcalPlacement: MealBlockKcal.legendTrailing,
        ),
      ),
    );

    // Measure the ENTRY boxes, not the text: each macro entry is a glyph plus
    // its label, so text-to-text gaps would fold in the next entry's icon.
    Rect macroEntry(String label) => tester.getRect(
          find.ancestor(of: find.text(label), matching: find.byType(Row)).first,
        );
    final entries = <Rect>[
      macroEntry('P 30g'),
      macroEntry('C 50g'),
      macroEntry('F 12g'),
      tester.getRect(find.text('480 kcal')),
    ];
    final gaps = <double>[
      for (var i = 1; i < entries.length; i++)
        entries[i].left - entries[i - 1].right,
    ];
    for (final gap in gaps) {
      expect(gap, closeTo(gaps.first, 1.0),
          reason: 'legend gaps must be uniform, got $gaps');
    }
  });

  testWidgets('the bar and legend END the block, below any middle content',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        MealBlock(
          title: 'expanded card',
          segments: composition.segments,
          gramLabels: const {
            'protein': 'P 30g',
            'carbohydrate': 'C 50g',
            'fat': 'F 12g',
          },
          kcalLabel: '480 kcal',
          kcalPlacement: MealBlockKcal.legendTrailing,
          middle: const SizedBox(height: 120, child: Text('per-dish detail')),
        ),
      ),
    );

    final detail = tester.getRect(find.text('per-dish detail'));
    final title = tester.getRect(find.text('expanded card'));
    final legend = tester.getRect(find.text('P 30g'));

    expect(detail.top, greaterThan(title.top),
        reason: 'the detail opens under the title');
    expect(legend.top, greaterThan(detail.bottom),
        reason: 'the bar + legend must close the card, under the detail rows');
  });
}

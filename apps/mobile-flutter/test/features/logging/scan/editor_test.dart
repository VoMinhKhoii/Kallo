import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/sheets/scan/editor/editor.dart';
import 'package:kallo_mobile/shared/widgets/typography/section_header_row.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import 'harness.dart';

/// What the editor says on screen: section headers like the Nutrition page's,
/// Save, why a figure can't be saved, and which figure it worked out itself.
void main() {
  setUpScanTests();

  Future<ScanHarness> editing(WidgetTester tester) async {
    final h = ScanHarness(tester);
    await h.open();
    await h.tapText('Enter manually');
    expect(find.byType(ScanFoodEditor), findsOneWidget);
    return h;
  }

  testWidgets('sections wear the Nutrition page header, and it says what is '
      'required', (tester) async {
    await editing(tester);
    for (final (title, meta) in [
      ('Macronutrients', 'Required to save'),
      ('Other nutrients', 'Optional'),
    ]) {
      final header = find.widgetWithText(SectionHeaderRow, title);
      expect(header, findsOneWidget);
      expect(
        find.descendant(of: header, matching: find.text(meta)),
        findsOneWidget,
      );
    }
    expect(find.text('Save'), findsOneWidget);
    expect(find.text('Done'), findsNothing);
  });

  testWidgets('a figure that cannot be saved says why, in red, under it', (
    tester,
  ) async {
    final h = await editing(tester);
    await h.type('Sodium', '60000');
    final error = find.text('Max 50,000 mg');
    expect(error, findsOneWidget);
    expect(tester.widget<Text>(error).style?.color, KalloColors.danger);
    expect(
      tester.getTopLeft(error).dy,
      greaterThan(tester.getBottomLeft(find.text('Sodium')).dy),
      reason: 'under the row, not beside it',
    );

    await h.type('Sodium', '600');
    expect(find.text('Max 50,000 mg'), findsNothing);
  });

  testWidgets('the fourth figure fills itself, says so, and a tap selects it', (
    tester,
  ) async {
    final h = await editing(tester);
    await h.type('Calories', '250');
    await h.type('Protein', '10');
    await h.type('Carbohydrates', '30');

    final fat = tester.widget<CupertinoTextField>(h.field('Fat'));
    expect(fat.controller!.text, '10');
    expect(find.text('Worked out from the other three'), findsOneWidget);

    await tester.ensureVisible(h.field('Fat'));
    await tester.tap(h.field('Fat'));
    await tester.pump();
    expect(
      fat.controller!.selection,
      const TextSelection(baseOffset: 0, extentOffset: 2),
      reason: 'typing replaces the worked-out figure',
    );

    await h.type('Fat', '8');
    expect(find.text('Worked out from the other three'), findsNothing);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/settings/widgets/inputs/select_row.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

/// The press wash, which a pre-PR review found had gone missing.
///
/// Collapsing `_DropdownRow` and `_CountryRow` into one row kept the country
/// rule (`selected ? wash : pressed`) and silently dropped the option rule
/// (`pressed`, regardless of selection). The option list carries selection in a
/// check glyph and supplies NO wash, so the currently-selected option answered
/// the finger with nothing at all. Both rules are pinned here.
Future<void> _pump(
  WidgetTester tester, {
  required bool selected,
  Color? selectedColor,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SelectRow(
          label: 'Tiếng Việt',
          selected: selected,
          selectedColor: selectedColor,
          onTap: () {},
        ),
      ),
    ),
  );
}

Color? _washOf(WidgetTester tester) {
  final box = tester.widget<AnimatedContainer>(find.byType(AnimatedContainer));
  return (box.decoration as BoxDecoration?)?.color;
}

/// Press and hold, without releasing — the state the wash exists for.
Future<TestGesture> _press(WidgetTester tester) async {
  final g = await tester.startGesture(tester.getCenter(find.byType(SelectRow)));
  await tester.pump();
  return g;
}

void main() {
  testWidgets('an option with no selected wash still washes on press', (
    tester,
  ) async {
    // The regression, exactly: selected, selectedColor null (CustomSelect).
    await _pump(tester, selected: true);
    expect(_washOf(tester), isNull, reason: 'at rest it paints nothing');

    final g = await _press(tester);
    expect(_washOf(tester), KalloColors.track);
    await g.up();
  });

  testWidgets('an unselected option washes on press', (tester) async {
    await _pump(tester, selected: false);
    final g = await _press(tester);
    expect(_washOf(tester), KalloColors.track);
    await g.up();
  });

  testWidgets('a supplied selected wash outranks the press wash', (
    tester,
  ) async {
    // CountrySelect's rule, unchanged: the selected country stays accent10
    // under the finger rather than flicking to the press grey.
    await _pump(tester, selected: true, selectedColor: KalloColors.accent10);
    expect(_washOf(tester), KalloColors.accent10);

    final g = await _press(tester);
    expect(_washOf(tester), KalloColors.accent10);
    await g.up();
  });

  testWidgets('released, the press wash goes away again', (tester) async {
    await _pump(tester, selected: true);
    final g = await _press(tester);
    await g.up();
    await tester.pumpAndSettle();
    expect(_washOf(tester), isNull);
  });
}

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/logic/split_parts.dart';
import 'package:kallo_mobile/features/circle/widgets/share/portion/portion_battery.dart';
import 'package:kallo_mobile/features/circle/widgets/share/portion/whole_portion_batteries.dart';
import 'package:kallo_mobile/features/circle/widgets/portion/portion_seats.dart';

List<PortionSeat> seatsFrom(List<int> parts) => [
  for (var i = 0; i < parts.length; i++)
    PortionSeat(
      id: 'u$i',
      initials: i == 0 ? 'B' : 'F$i',
      label: i == 0 ? 'Bạn' : 'Người $i',
      parts: parts[i],
    ),
];

Future<void> pump(
  WidgetTester tester, {
  required List<int> parts,
  bool interactive = true,
  ValueChanged<List<int>>? onChanged,
  ValueChanged<int>? onRemove,
}) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 358,
            child: PortionBattery(
              seats: seatsFrom(parts),
              totalKcal: 1040,
              interactive: interactive,
              onChanged: onChanged,
              onRemove: onRemove,
            ),
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('draws one cell per part, coloured by seat', (tester) async {
    await pump(tester, parts: [13, 7]);

    // Every part is its own cell, so the dish is always countable. Cells are
    // keyed by PERSON, not position — the same keying the tab morph needs.
    int cellsFor(String userId) =>
        find
            .byWidgetPredicate(
              (w) =>
                  w.key is ValueKey<String> &&
                  (w.key as ValueKey<String>).value.startsWith('cell-$userId-'),
            )
            .evaluate()
            .length;
    expect(cellsFor('u0') + cellsFor('u1'), kTotalParts);
    expect(cellsFor('u0'), 13);
    expect(cellsFor('u1'), 7);
  });

  testWidgets('one notch per internal boundary, never on the ends', (
    tester,
  ) async {
    await pump(tester, parts: [7, 7, 6]);
    // Three people, two seams between them.
    expect(find.byType(GestureDetector).evaluate().length, greaterThan(0));
    final sliders = tester
        .widgetList<Semantics>(find.byType(Semantics))
        .where((s) => s.properties.slider == true);
    expect(sliders.length, 2);
  });

  testWidgets('read-only instances have no notches at all', (tester) async {
    await pump(tester, parts: [13, 7], interactive: false);
    final sliders = tester
        .widgetList<Semantics>(find.byType(Semantics))
        .where((s) => s.properties.slider == true);
    // Gone entirely rather than disabled: the recipient's copy is a picture.
    expect(sliders, isEmpty);
  });

  testWidgets('each notch announces both neighbours and their parts', (
    tester,
  ) async {
    await pump(tester, parts: [13, 7]);
    final slider = tester
        .widgetList<Semantics>(find.byType(Semantics))
        .firstWhere((s) => s.properties.slider == true);
    expect(slider.properties.value, contains('Bạn 13 phần'));
    expect(slider.properties.value, contains('Người 1 7 phần'));
    expect(slider.properties.onIncrease, isNotNull);
    expect(slider.properties.onDecrease, isNotNull);
  });

  testWidgets('increase moves exactly one part to the left run', (
    tester,
  ) async {
    List<int>? got;
    await pump(tester, parts: [10, 10], onChanged: (p) => got = p);

    final handle = tester.ensureSemantics();
    tester.semantics.performAction(
      find.semantics.byLabel(RegExp('Bạn và Người 1')),
      SemanticsAction.increase,
    );
    await tester.pump();

    expect(got, [11, 9]);
    handle.dispose();
  });

  testWidgets('refuses to step past the floor instead of reporting a change', (
    tester,
  ) async {
    List<int>? got;
    // The right run is already at the floor.
    await pump(tester, parts: [18, 2], onChanged: (p) => got = p);

    final handle = tester.ensureSemantics();
    tester.semantics.performAction(
      find.semantics.byLabel(RegExp('Bạn và Người 1')),
      SemanticsAction.increase,
    );
    await tester.pump();

    // No change reported at all — the control simply stops, which is the only
    // refusal that needs no words.
    expect(got, isNull);
    handle.dispose();
  });

  testWidgets('you can never remove yourself', (tester) async {
    final removed = <int>[];
    await pump(tester, parts: [7, 7, 6], onRemove: removed.add);

    // One × per seat EXCEPT seat 0.
    expect(find.byIcon(LucideIcons.x300), findsNWidgets(2));
  });

  testWidgets('no remove badges when the caller offers no handler', (
    tester,
  ) async {
    await pump(tester, parts: [7, 7, 6]);
    expect(find.byIcon(LucideIcons.x300), findsNothing);
  });

  testWidgets('tapping a badge removes that seat', (tester) async {
    final removed = <int>[];
    await pump(tester, parts: [7, 7, 6], onRemove: removed.add);

    await tester.tap(find.byIcon(LucideIcons.x300).first);
    await tester.pump();
    expect(removed, [1]);
  });

  testWidgets('whole mode: remove a friend from their own battery, never you', (
    tester,
  ) async {
    final removed = <int>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 358,
              child: WholePortionBatteries(
                seats: seatsFrom([7, 7, 6]),
                totalKcal: 1040,
                onRemove: removed.add,
              ),
            ),
          ),
        ),
      ),
    );

    // Each battery holds one seat at local index 0, so a position-based gate
    // would hide every badge. Two friends, two badges.
    expect(find.byIcon(LucideIcons.x300), findsNWidgets(2));
    await tester.tap(find.byIcon(LucideIcons.x300).last);
    await tester.pump();
    expect(removed, [2]);
  });

  testWidgets('cells actually occupy the shell', (tester) async {
    await pump(tester, parts: [13, 7]);

    // Counting cells by key passes even when every one of them is zero-height:
    // a DecoratedBox with no child takes its size from its constraints, and a
    // centred Row hands out LOOSE ones. That shipped an empty shell once.
    final cell =
        find
            .byWidgetPredicate(
              (w) =>
                  w.key is ValueKey<String> &&
                  (w.key as ValueKey<String>).value.startsWith('cell-u0-'),
            )
            .first;
    final size = tester.getSize(cell);
    expect(size.height, greaterThan(40));
    expect(size.width, greaterThan(0));
  });

  testWidgets('fits six seats without overflowing', (tester) async {
    await pump(tester, parts: evenParts(6));
    expect(tester.takeException(), isNull);
  });
}

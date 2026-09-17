import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/logic/split_parts.dart';
import 'package:kallo_mobile/features/circle/widgets/share/portion/portion_battery.dart';
import 'package:kallo_mobile/features/circle/widgets/share/portion/whole_portion_batteries.dart';
import 'package:kallo_mobile/features/circle/widgets/portion/portion_seats.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/shared/widgets/avatar/profile_avatar.dart';

List<PortionSeat> seatsFrom(List<int> parts) => [
      for (var i = 0; i < parts.length; i++)
        PortionSeat(
          id: 'u$i',
          initials: i == 0 ? 'B' : 'F$i',
          label: i == 0 ? 'Bạn' : 'Người $i',
          parts: parts[i],
        ),
    ];

/// The same seat, with a photo. Its URL never resolves in a widget test — the
/// binding answers every request with a 400 — which is exactly what these
/// assertions want: they check that `ProfileAvatarDisc` is REACHED, not what
/// it paints. The seat-colour-and-initials path is the other test.
PortionSeat withPhoto(PortionSeat seat) => PortionSeat(
      id: seat.id,
      profile: CircleProfile(
        userId: seat.id,
        handle: seat.id,
        displayName: seat.label,
        avatarUrl: 'https://example.test/${seat.id}.jpg',
      ),
      initials: seat.initials,
      label: seat.label,
      parts: seat.parts,
    );

Future<void> pump(
  WidgetTester tester, {
  required List<int> parts,
  bool interactive = true,
  double width = 358,
  List<PortionSeat>? seats,
  ValueChanged<List<int>>? onChanged,
  ValueChanged<int>? onRemove,
}) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: width,
            child: PortionBattery(
              seats: seats ?? seatsFrom(parts),
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
    int cellsFor(String userId) => find
        .byWidgetPredicate((w) =>
            w.key is ValueKey<String> &&
            (w.key as ValueKey<String>).value.startsWith('cell-$userId-'))
        .evaluate()
        .length;
    expect(cellsFor('u0') + cellsFor('u1'), kTotalParts);
    expect(cellsFor('u0'), 13);
    expect(cellsFor('u1'), 7);
  });

  testWidgets('one notch per internal boundary, never on the ends',
      (tester) async {
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

  testWidgets('each notch announces both neighbours and their parts',
      (tester) async {
    await pump(tester, parts: [13, 7]);
    final slider = tester
        .widgetList<Semantics>(find.byType(Semantics))
        .firstWhere((s) => s.properties.slider == true);
    expect(slider.properties.value, contains('Bạn 13 phần'));
    expect(slider.properties.value, contains('Người 1 7 phần'));
    expect(slider.properties.onIncrease, isNotNull);
    expect(slider.properties.onDecrease, isNotNull);
  });

  testWidgets('increase moves exactly one part to the left run',
      (tester) async {
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

  testWidgets('refuses to step past the floor instead of reporting a change',
      (tester) async {
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

  testWidgets('no remove badges when the caller offers no handler',
      (tester) async {
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

  testWidgets('whole mode: remove a friend from their own battery, never you',
      (tester) async {
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
    final cell = find
        .byWidgetPredicate((w) =>
            w.key is ValueKey<String> &&
            (w.key as ValueKey<String>).value.startsWith('cell-u0-'))
        .first;
    final size = tester.getSize(cell);
    expect(size.height, greaterThan(40));
    expect(size.width, greaterThan(0));
  });

  testWidgets('fits six seats without overflowing', (tester) async {
    await pump(tester, parts: evenParts(6));
    expect(tester.takeException(), isNull);
  });

  testWidgets('draws a face in the pin when the person has a photo',
      (tester) async {
    final seats = seatsFrom([10, 10]);
    await pump(
      tester,
      parts: const [10, 10],
      seats: [seats.first, withPhoto(seats[1])],
    );

    expect(find.byType(ProfileAvatarDisc), findsOneWidget);
    // Seat 0 has no photo, and its "initials" are the localised "You" — never
    // a name initial — so it keeps the glyph rather than falling back to the
    // avatar widget's own disc.
    expect(find.text('B'), findsOneWidget);
  });

  testWidgets('falls back to initials for everyone without a photo',
      (tester) async {
    await pump(tester, parts: [10, 10]);
    expect(find.byType(ProfileAvatarDisc), findsNothing);
    expect(find.text('B'), findsOneWidget);
    expect(find.text('F1'), findsOneWidget);
  });

  testWidgets('keeps the drop square on a run too narrow to hold it',
      (tester) async {
    // A 2-part run on a small phone is ~29pt wide against a 40pt drop-plus-
    // ring. It must overlap its neighbour rather than be squeezed to an oval.
    await pump(tester, parts: [kMinParts, kTotalParts - kMinParts], width: 288);
    expect(
      tester.getSize(
        find
            .descendant(
              of: find.byKey(const ValueKey('pin-u0')),
              matching: find.byType(Transform),
            )
            .first,
      ),
      const Size(40, 40),
    );
  });

  testWidgets('whole mode carries the photo through the reseat',
      (tester) async {
    // WholePortionBatteries rebuilds every seat so each gets its own battery.
    // Before copyWith() that was a hand-written six-field copy — one forgotten
    // line away from silently dropping every face in this tab.
    final seats = seatsFrom([10, 10]);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 358,
              child: WholePortionBatteries(
                seats: [seats.first, withPhoto(seats[1])],
                totalKcal: 1040,
                onRemove: (_) {},
              ),
            ),
          ),
        ),
      ),
    );
    expect(find.byType(ProfileAvatarDisc), findsOneWidget);
  });
}

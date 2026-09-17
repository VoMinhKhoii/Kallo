import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/circle/widgets/invite/portion_readout.dart';
import 'package:kallo_mobile/features/circle/logic/split_parts.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

Future<void> pumpReadout(WidgetTester tester, {required int minePercent}) {
  return tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 326,
            child: PortionReadout(
              minePercent: minePercent,
              mineColor: const Color(0xFF12B76A),
              mineLabel: 'Bạn $minePercent%',
              restLabel: 'Đã chia ${100 - minePercent}%',
            ),
          ),
        ),
      ),
    ),
  );
}

int cellsOfColour(WidgetTester tester, Color color) =>
    tester
        .widgetList<DecoratedBox>(find.byType(DecoratedBox))
        .where((d) => (d.decoration as BoxDecoration).color == color)
        .length;

void main() {
  testWidgets('tints only the reader\'s own run', (tester) async {
    await pumpReadout(tester, minePercent: 35);

    // 35% of a 20-part dish is 7 parts; the rest stays on the neutral track
    // because one invite cannot know how the remainder was divided.
    expect(cellsOfColour(tester, const Color(0xFF12B76A)), 7);
    expect(cellsOfColour(tester, KalloColors.track), kTotalParts - 7);
  });

  testWidgets('snaps to the grid the sender actually divided on', (
    tester,
  ) async {
    // 33% is not a whole number of parts. It must land on one anyway, or the
    // bar shows a boundary the control could never have produced.
    await pumpReadout(tester, minePercent: 33);
    final mine = cellsOfColour(tester, const Color(0xFF12B76A));
    expect(mine, 7);
    expect(mine + cellsOfColour(tester, KalloColors.track), kTotalParts);
  });

  testWidgets('survives the extremes without dropping or doubling cells', (
    tester,
  ) async {
    for (final percent in [0, 10, 50, 90, 100]) {
      await pumpReadout(tester, minePercent: percent);
      final total =
          cellsOfColour(tester, const Color(0xFF12B76A)) +
          cellsOfColour(tester, KalloColors.track);
      expect(total, kTotalParts, reason: 'at $percent%');
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('reads both shares out as one label', (tester) async {
    await pumpReadout(tester, minePercent: 35);
    final semantics = tester.getSemantics(find.byType(PortionReadout));
    expect(semantics.label, contains('Bạn 35%'));
    expect(semantics.label, contains('Đã chia 65%'));
  });
}

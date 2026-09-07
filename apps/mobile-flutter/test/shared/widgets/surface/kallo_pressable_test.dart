import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/surface/kallo_pressable.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

/// The press contract the primitive exists to guarantee: washed for the WHOLE
/// hold (past the long-press threshold, where an arena-driven wash dies),
/// fires on release, drag-off clears without firing, disabled never washes.
void main() {
  Color washOf(WidgetTester tester) {
    final box = tester.widget<AnimatedContainer>(
      find.byType(AnimatedContainer),
    );
    return (box.decoration! as BoxDecoration).color!;
  }

  Future<void> pump(WidgetTester tester, {VoidCallback? onTap}) =>
      tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: Center(
            child: KalloPressable(
              onTap: onTap,
              height: 44,
              constraints: const BoxConstraints(minWidth: 120),
              child: const Text('go'),
            ),
          ),
        ),
      );

  testWidgets('stays washed through a long hold, then fires on release', (
    tester,
  ) async {
    var fired = 0;
    await pump(tester, onTap: () => fired++);

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(washOf(tester), KalloColors.pressWash);
    // Well past kLongPressTimeout, finger still down.
    await tester.pump(const Duration(milliseconds: 1200));
    expect(
      washOf(tester),
      KalloColors.pressWash,
      reason: 'the wash must survive the long-press threshold',
    );

    await gesture.up();
    await tester.pumpAndSettle();
    expect(washOf(tester), const Color(0x00000000));
    expect(fired, 1);
  });

  testWidgets('a drag-off clears the wash and fires nothing', (tester) async {
    var fired = 0;
    await pump(tester, onTap: () => fired++);

    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(washOf(tester), KalloColors.pressWash);
    await gesture.moveBy(const Offset(0, 200));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(washOf(tester), const Color(0x00000000));
    expect(fired, 0);
  });

  testWidgets('disabled never washes', (tester) async {
    await pump(tester, onTap: null);
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('go')),
    );
    await tester.pump(const Duration(milliseconds: 300));
    expect(washOf(tester), const Color(0x00000000));
    await gesture.up();
  });
}

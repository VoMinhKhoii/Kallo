import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/surface/kallo_small_button.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

/// The secondary button: a 34pt squircle on a 44pt hit target, outline by
/// default, solid ink for a rare action.
void main() {
  ShapeDecoration shapeOf(WidgetTester tester) =>
      tester
              .widget<Container>(
                find.descendant(
                  of: find.byType(KalloSmallButton),
                  matching: find.byType(Container),
                ),
              )
              .decoration!
          as ShapeDecoration;

  Future<int> pump(
    WidgetTester tester, {
    KalloSmallButtonVariant variant = KalloSmallButtonVariant.outline,
  }) async {
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: KalloSmallButton(
              label: 'Xem nhóm',
              variant: variant,
              onPressed: () => taps++,
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Xem nhóm'));
    await tester.pumpAndSettle();
    return taps;
  }

  testWidgets('outline: white squircle with the hairline, 34pt in a 44pt '
      'target', (tester) async {
    expect(await pump(tester), 1);

    final shape = shapeOf(tester);
    expect(shape.color, kCardSurface);
    expect(shape.shape, isA<RoundedSuperellipseBorder>());
    expect((shape.shape as RoundedSuperellipseBorder).side.color, kHairline);
    expect(
      tester
          .getSize(
            find.descendant(
              of: find.byType(KalloSmallButton),
              matching: find.byType(Container),
            ),
          )
          .height,
      KalloSmallButton.height,
    );
    expect(
      tester.getSize(find.byType(KalloSmallButton)).height,
      greaterThanOrEqualTo(44),
    );
  });

  testWidgets('ink: solid black, no border', (tester) async {
    expect(await pump(tester, variant: KalloSmallButtonVariant.ink), 1);

    final shape = shapeOf(tester);
    expect(shape.color, kInk);
    expect((shape.shape as RoundedSuperellipseBorder).side, BorderSide.none);
  });
}

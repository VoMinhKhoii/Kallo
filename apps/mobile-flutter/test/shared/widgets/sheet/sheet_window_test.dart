import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';

void main() {
  for (final width in [466.0, 951.0]) {
    for (final left in [false, true]) {
      testWidgets('sheet in safe pane at $width, left column $left', (
        tester,
      ) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 678);
        final inset = FakeViewPadding(
          left: left ? 84 : 0,
          right: left ? 0 : 84,
          bottom: 34,
        );
        tester.view.viewPadding = inset;
        tester.view.padding = inset;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Builder(
                builder:
                    (context) => TextButton(
                      onPressed:
                          () => showNhamSheet<void>(
                            context,
                            builder:
                                (_) => const KalloSheetSurface(
                                  child: SizedBox(
                                    height: 200,
                                    width: double.infinity,
                                  ),
                                ),
                          ),
                      child: const Text('open'),
                    ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        final rect = tester.getRect(
          find.byWidgetPredicate(
            (w) => w is Container && w.decoration is ShapeDecoration,
          ),
        );
        final start =
            left
                ? 84.0
                : width >= 840
                ? width / 2 + 20
                : 0.0;
        final end =
            left && width >= 840
                ? width / 2 - 20
                : left
                ? width
                : width - 84;
        expect(rect.left, start);
        expect(rect.right, end);
        expect(rect.bottom, 678);
        expect(rect.width, lessThanOrEqualTo(640));
        expect(tester.takeException(), isNull);
      });
    }
  }
  testWidgets('wide sheet caps and centres at 640', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1200, 800);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Align(
            alignment: Alignment.bottomCenter,
            child: KalloSheetSurface(
              child: SizedBox(width: double.infinity, height: 100),
            ),
          ),
        ),
      ),
    );
    final rect = tester.getRect(
      find.byWidgetPredicate(
        (w) => w is Container && w.decoration is ShapeDecoration,
      ),
    );
    expect(rect.width, 640);
    expect(rect.center.dx, 600);
  });
}

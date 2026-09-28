import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/form/save_dock.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_button.dart';

/// The dock has to stay reachable while the keyboard is up. Every edit page
/// that hosts it lives under `/settings`, a root route with no `Scaffold`, so
/// nothing resizes the page for the keyboard: before 2026-09-28 the dock sat
/// under the keys and Save could only be reached by dismissing them first.
void main() {
  const screen = Size(390, 844);
  const keyboard = 336.0;
  const homeIndicator = 34.0;

  Future<int> pumpDock(
    WidgetTester tester, {
    required double keyboardInset,
  }) async {
    tester.view.physicalSize = screen;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          // What iOS reports with the keyboard up: the indicator stays in
          // `viewPadding`, and `padding` nets it against the keyboard.
          data: MediaQueryData(
            size: screen,
            viewPadding: const EdgeInsets.only(bottom: homeIndicator),
            padding: EdgeInsets.only(
              bottom: keyboardInset > 0 ? 0 : homeIndicator,
            ),
            viewInsets: EdgeInsets.only(bottom: keyboardInset),
          ),
          child: Stack(
            children: [
              const SizedBox.expand(),
              SaveDock(visible: true, label: 'Save', onPressed: () => taps++),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byType(KalloButton));
    return taps;
  }

  testWidgets('with the keyboard up the button sits above it and saves', (
    tester,
  ) async {
    final taps = await pumpDock(tester, keyboardInset: keyboard);

    final button = tester.getRect(find.byType(KalloButton));
    expect(button.bottom, lessThanOrEqualTo(screen.height - keyboard));
    // Rides the keyboard's top edge: its 12pt frame, not the home
    // indicator's 34 on top of it.
    expect(button.bottom, screen.height - keyboard - 12);
    expect(taps, 1);
  });

  testWidgets('with the keyboard down it clears the home indicator', (
    tester,
  ) async {
    final taps = await pumpDock(tester, keyboardInset: 0);

    final button = tester.getRect(find.byType(KalloButton));
    expect(button.bottom, screen.height - homeIndicator - 12);
    expect(taps, 1);
  });
}

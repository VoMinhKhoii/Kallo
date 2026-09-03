import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer/composer_dock.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_screen.dart';
import 'package:kallo_mobile/shared/widgets/surface/scroll_separator.dart';

/// The logging feed's composer must ride the keyboard.
///
/// `/logging` is a root `CupertinoPage` with NO `Scaffold`, so nothing applies
/// `resizeToAvoidBottomInset` for it: whatever lifts the dock over the keyboard
/// has to read `MediaQuery.viewInsets.bottom` itself. These reproduce the two
/// halves of the reported bug — the dock sitting UNDER the keyboard, and the
/// dock's edge not tracking the inset frame by frame as iOS ramps it.
const Size _screen = Size(390, 844);
const double _indicator = 34; // the home indicator's viewPadding
const double _keyboard = 300;

/// Sets the inset the way the engine does: `padding` is `viewPadding` already
/// eaten by `viewInsets`, so the two must move together or the test asserts a
/// state iOS never produces.
void _setInset(WidgetTester tester, double inset) {
  tester.view.physicalSize = _screen;
  tester.view.devicePixelRatio = 1.0;
  tester.view.viewInsets = FakeViewPadding(bottom: inset);
  tester.view.viewPadding = const FakeViewPadding(bottom: _indicator);
  tester.view.padding = FakeViewPadding(
    bottom: inset >= _indicator ? 0 : _indicator - inset,
  );
}

/// The real composition: `Screen(bottom: false)` → a column → the feed's
/// `ScrollSeparator`, whose `overlay` slot pins the dock to the bottom.
Widget _host({ValueChanged<double>? onHeightChanged}) => MaterialApp(
  home: Screen(
    bottom: false,
    child: Column(
      children: [
        const SizedBox(height: 58), // the date strip
        Expanded(
          child: ScrollSeparator(
            header: const SizedBox(height: 80),
            overlay: Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: ComposerDock(
                onHeightChanged: onHeightChanged ?? (_) {},
                child: const SizedBox(height: 64, child: Text('composer')),
              ),
            ),
            child: ListView.builder(
              itemCount: 20,
              itemBuilder: (_, i) => SizedBox(height: 100, child: Text('$i')),
            ),
          ),
        ),
      ],
    ),
  ),
);

/// The dock's PAINTED bottom edge — its opaque base. `ComposerDock`'s own box
/// runs to the screen bottom by design once it carries the keyboard lift as
/// padding, so measuring the element would measure the lift, not the dock.
Rect _dock(WidgetTester tester) => tester.getRect(
  find
      .descendant(of: find.byType(ComposerDock), matching: find.byType(Container))
      .first,
);

void main() {
  testWidgets('the dock sits on top of the keyboard, not under it', (
    tester,
  ) async {
    addTearDown(tester.view.reset);
    _setInset(tester, _keyboard);
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    expect(
      _dock(tester).bottom,
      closeTo(_screen.height - _keyboard, 0.01),
      reason: 'the composer must end where the keyboard begins',
    );
  });

  testWidgets('the dock tracks the inset every frame of the ramp', (
    tester,
  ) async {
    addTearDown(tester.view.reset);
    _setInset(tester, 0);
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    // iOS ramps `viewInsets` continuously over ~250ms; sample it up and back
    // down the way the engine delivers it.
    final insets = <double>[
      for (var i = 0; i <= 30; i++) i * 10.0,
      for (var i = 29; i >= 0; i--) i * 10.0,
    ];
    double? previousBottom;
    for (final inset in insets) {
      _setInset(tester, inset);
      await tester.pump(const Duration(milliseconds: 8));
      final bottom = _dock(tester).bottom;
      expect(
        bottom,
        closeTo(_screen.height - inset, 0.01),
        reason: 'the dock lost the keyboard at inset $inset',
      );
      if (previousBottom != null) {
        expect(
          (bottom - previousBottom).abs(),
          lessThanOrEqualTo(10 + 0.01),
          reason: 'the dock jumped at inset $inset',
        );
      }
      previousBottom = bottom;
    }
  });

  testWidgets('the keyboard never enters the height it reports', (
    tester,
  ) async {
    addTearDown(tester.view.reset);
    _setInset(tester, 0);
    final heights = <double>[];
    await tester.pumpWidget(_host(onHeightChanged: heights.add));
    await tester.pumpAndSettle();
    final resting = heights.last;

    // The lift must NOT travel through this measurement: the report is
    // post-frame, so the feed would reserve the keyboard's room a frame late —
    // and would rebuild in full on every frame of the ramp.
    for (var i = 0; i <= 30; i++) {
      _setInset(tester, i * 10.0);
      await tester.pump(const Duration(milliseconds: 8));
    }
    await tester.pumpAndSettle();

    // The only movement allowed is the home indicator the dock stops paying
    // once the keyboard covers it — 34, continuously, over the last 34pt of
    // the ramp. The keyboard's own 300 must never appear here.
    expect(
      heights.every((h) => h <= resting && h >= resting - _indicator),
      isTrue,
      reason: 'reported heights $heights left the dock\'s own range',
    );
  });

  testWidgets('at rest the dock still clears the home indicator', (
    tester,
  ) async {
    addTearDown(tester.view.reset);
    _setInset(tester, 0);
    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    expect(_dock(tester).bottom, closeTo(_screen.height, 0.01));
    // The composer's own box has to stay off the indicator.
    expect(
      _screen.height - tester.getRect(find.text('composer')).bottom,
      greaterThanOrEqualTo(_indicator),
    );
  });
}

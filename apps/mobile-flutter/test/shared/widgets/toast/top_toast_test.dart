import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/toast/top_toast.dart';

/// The toast is inserted into the ROOT overlay, above every Material in the
/// app. Text with no Material ancestor inherits Flutter's fallback style, which
/// carries a yellow double underline; `dashBody` merges onto it and overrides
/// colour/size/family but not `decoration`, so the underline used to survive
/// and paint yellow under the message.
TextStyle _resolvedStyle(WidgetTester tester, String text) {
  final richText = tester.widget<RichText>(
    find.descendant(of: find.text(text), matching: find.byType(RichText)),
  );
  return (richText.text as TextSpan).style!;
}

Widget _host(void Function(BuildContext) show) => MaterialApp(
  home: Scaffold(
    body: Builder(
      builder:
          (context) => TextButton(
            onPressed: () => show(context),
            child: const Text('go'),
          ),
    ),
  ),
);

void main() {
  testWidgets('message carries no inherited text decoration', (tester) async {
    await tester.pumpWidget(_host((c) => showTopToast(c, 'Saved')));
    await tester.tap(find.text('go'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    final style = _resolvedStyle(tester, 'Saved');
    expect(style.decoration ?? TextDecoration.none, TextDecoration.none);
    // decorationColor is inherited from the theme and is inert while there is
    // no decoration; what must never come back is the fallback's yellow.
    expect(style.decorationColor, isNot(const Color(0xFFFFFF00)));

    await tester.pumpAndSettle(const Duration(seconds: 3));
  });

  testWidgets('action label carries no inherited text decoration', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host((c) => showTopToast(c, 'Removed', actionLabel: 'Undo')),
    );
    await tester.tap(find.text('go'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    final style = _resolvedStyle(tester, 'Undo');
    expect(style.decoration ?? TextDecoration.none, TextDecoration.none);
    // decorationColor is inherited from the theme and is inert while there is
    // no decoration; what must never come back is the fallback's yellow.
    expect(style.decorationColor, isNot(const Color(0xFFFFFF00)));

    await tester.pumpAndSettle(const Duration(seconds: 3));
  });

  testWidgets('an action toast leaves on an upward flick', (tester) async {
    await tester.pumpWidget(
      _host(
        (c) => showTopToast(
          c,
          'Deleted',
          actionLabel: 'Undo',
          onAction: () {},
          // Long, so anything that dismisses inside the test is the GESTURE
          // and not the countdown quietly expiring.
          duration: const Duration(seconds: 30),
        ),
      ),
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();
    expect(find.text('Deleted'), findsOneWidget);

    await tester.fling(find.text('Deleted'), const Offset(0, -60), 900);
    await tester.pumpAndSettle();

    expect(find.text('Deleted'), findsNothing);
  });

  testWidgets('a downward drag does NOT dismiss it', (tester) async {
    // Downward is far more likely to be a page scroll that started slightly
    // too high than an intent to dismiss, so only the upward flick counts.
    await tester.pumpWidget(
      _host(
        (c) => showTopToast(
          c,
          'Deleted',
          actionLabel: 'Undo',
          onAction: () {},
          duration: const Duration(seconds: 30),
        ),
      ),
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();

    await tester.fling(find.text('Deleted'), const Offset(0, 60), 900);
    await tester.pumpAndSettle();

    expect(find.text('Deleted'), findsOneWidget);
    await tester.pumpAndSettle(const Duration(seconds: 31));
  });

  testWidgets('a finger on an action toast pauses its countdown', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        (c) => showTopToast(
          c,
          'Deleted',
          actionLabel: 'Undo',
          onAction: () {},
          duration: const Duration(seconds: 1),
        ),
      ),
    );
    await tester.tap(find.text('go'));
    // NOT pumpAndSettle: the TextButton's own splash keeps frames scheduled
    // long enough to run the dwell out before the hold starts. Pump just past
    // the 260ms entrance instead.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Hold well past the 1s dwell without lifting.
    final gesture = await tester.startGesture(
      tester.getCenter(find.text('Deleted')),
    );
    await tester.pump(const Duration(seconds: 3));
    expect(
      find.text('Deleted'),
      findsOneWidget,
      reason: 'the countdown must not expire under a finger',
    );

    // Lifting restarts it, so it still leaves on its own afterwards.
    await gesture.up();
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Deleted'), findsNothing);
  });

  testWidgets('a passive toast stays untouchable', (tester) async {
    // The IgnorePointer contract: a toast over a button must never eat the
    // press meant for it. This is why swipe-to-dismiss and hold-to-pause are
    // fitted to the ACTION variant only.
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          // SizedBox.expand, and every child positioned: a bare Stack sizes to
          // its largest NON-positioned child, and StackFit.expand instead makes
          // the button fill and swallow everything. Both were wrong before this
          // shape, and both failed in a way that looked like a product bug.
          body: SizedBox.expand(
            child: Stack(
              children: [
                Positioned.fill(
                  child: GestureDetector(
                    onTap: () => taps++,
                    behavior: HitTestBehavior.opaque,
                  ),
                ),
                Positioned(
                  bottom: 24,
                  left: 24,
                  child: Builder(
                    builder:
                        (context) => TextButton(
                          onPressed: () => showTopToast(context, 'Saved'),
                          child: const Text('go'),
                        ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('go'));
    await tester.pumpAndSettle();
    expect(find.text('Saved'), findsOneWidget);

    await tester.tapAt(tester.getCenter(find.text('Saved')));
    await tester.pump();
    expect(taps, 1, reason: 'the tap must pass through the passive toast');

    await tester.pumpAndSettle(const Duration(seconds: 3));
  });
}

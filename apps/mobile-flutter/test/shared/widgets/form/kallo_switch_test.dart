import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/form/kallo_switch.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

/// [KalloSwitch] is now a thin skin on [CupertinoSwitch]: one colour, and the
/// platform's own geometry, drag and press-stretch underneath.
///
/// The file used to carry a fourth test — a bare `Switch.adaptive` under a
/// `switchTheme`, asserting the theme did NOT reach it — which was the reason
/// the wrapper needed a widget-level `trackColor` resolver at all. That
/// resolver is gone with `Switch.adaptive`, so the test has nothing left to
/// justify and is retired rather than quietly deleted.
void main() {
  Widget host({TargetPlatform? platform, required Widget child}) => MaterialApp(
    theme: ThemeData(platform: platform ?? TargetPlatform.iOS),
    home: Scaffold(body: Center(child: child)),
  );

  RenderObject trackOf(WidgetTester tester) =>
      tester.renderObject(find.byType(CupertinoSwitch));

  for (final platform in [TargetPlatform.iOS, TargetPlatform.android]) {
    testWidgets('checked track is umber on $platform', (tester) async {
      // Both platforms, because a CupertinoSwitch renders the same everywhere
      // — which is the point of naming it directly instead of adapting.
      await tester.pumpWidget(
        host(
          platform: platform,
          child: KalloSwitch(value: true, onChanged: (_) {}),
        ),
      );
      await tester.pumpAndSettle();

      expect(trackOf(tester), paints..rrect(color: KalloColors.btn));
    });
  }

  testWidgets('unchecked track keeps the platform default, not umber', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(child: KalloSwitch(value: false, onChanged: (_) {})),
    );
    await tester.pumpAndSettle();

    expect(trackOf(tester), isNot(paints..rrect(color: KalloColors.btn)));
  });

  // No test for the pressed thumb stretch. Two attempts at one were worse
  // than none: the first passed with no finger down at all (it was matching
  // the 51x31 TRACK, which is already wider than it is tall), and the second
  // could not isolate the thumb reliably across paint calls. The behaviour is
  // real — `_kThumbExtensionFactor = 7.0` in `cupertino/switch.dart`, applied
  // as `reaction.value * _kThumbExtensionFactor` — but it belongs to the SDK,
  // and a brittle paint assertion here would fail on an SDK retune while
  // catching nothing we own.

  /// The target is [KalloSwitch]'s own box: the private `_TapTargetPadding`
  /// inside it is what grows to 44, and the widget under test is the honest
  /// public handle on it.
  Rect targetOf(WidgetTester tester) =>
      tester.getRect(find.byType(KalloSwitch));

  testWidgets('the tap target clears the 44pt floor', (tester) async {
    // CupertinoSwitch renders at 59x39 — 5pt under the floor. Switch.adaptive
    // hid that behind Material's padded tap target (>=48); taking the
    // Cupertino widget directly gives that up. Nothing caught the regression
    // when this file only asserted colour and semantics, so it asserts size
    // now. Its sibling commit spends a whole ConstrainedBox reaching 44 on the
    // cheat chips — the same floor has to hold here.
    await tester.pumpWidget(
      host(child: KalloSwitch(value: true, onChanged: (_) {})),
    );
    await tester.pumpAndSettle();

    expect(targetOf(tester).height, greaterThanOrEqualTo(KalloIcons.hit));
    // And the control itself must NOT have grown to get there.
    expect(tester.getSize(find.byType(CupertinoSwitch)).height, lessThan(44));
  });

  testWidgets('a tap in the 44pt band toggles, and only once', (tester) async {
    // Size is only half the floor. The first attempt at this laid out to 44
    // through a ConstrainedBox and a Center, neither of which claims a hit, so
    // a finger 1pt from the top edge — inside the target, outside the 39pt
    // switch — fell through to nothing, and the size assertion above was
    // perfectly satisfied.
    var toggles = 0;
    bool? last;
    await tester.pumpWidget(
      host(
        child: KalloSwitch(
          value: false,
          onChanged: (v) {
            toggles++;
            last = v;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    final rect = targetOf(tester);
    expect(
      rect.height - tester.getSize(find.byType(CupertinoSwitch)).height,
      greaterThan(2),
      reason: 'there has to BE a band for this test to mean anything',
    );

    await tester.tapAt(rect.center);
    await tester.tapAt(Offset(rect.center.dx, rect.top + 1));
    await tester.pumpAndSettle();

    // Two taps, two toggles — not three. The redirect hands the pointer to the
    // switch's own recogniser rather than adding a second one beside it.
    expect(toggles, 2);
    expect(last, isTrue);
  });

  testWidgets('a DRAG starting in the band still throws the switch', (
    tester,
  ) async {
    // What the tap-forwarding version got wrong, and what a tap test cannot
    // see. `CupertinoSwitch` is draggable; a forwarded `onTap` cancels the
    // moment the finger passes slop, so the band was dead to the one gesture
    // the control is actually built around. Redirecting the hit puts the
    // switch's own HorizontalDragGestureRecognizer in the arena instead.
    bool? last;
    await tester.pumpWidget(
      host(child: KalloSwitch(value: false, onChanged: (v) => last = v)),
    );
    await tester.pumpAndSettle();

    final rect = targetOf(tester);
    // The BOTTOM band, deliberately: `Size.contains` is half-open on the far
    // edges, so a redirect that lands a point exactly on `height` reports no
    // hit and kills this edge while the top one keeps working.
    final gesture = await tester.startGesture(
      Offset(rect.left + 12, rect.bottom - 0.5),
    );
    await tester.pump();
    // In steps, not one jump. `DragStartBehavior.start` consumes the first
    // movement as the drag's own start, so a single `moveBy` fires
    // `_handleDragStart` and NO `_handleDragUpdate` — leaving `_dragValue`
    // equal to `widget.value`, which makes `_handleDragEnd` skip `onChanged`
    // (`cupertino/switch.dart:633`). That is a harness artefact, not the
    // switch declining the gesture; the first version of this test read it as
    // a failure of the fix.
    // Six steps of 12, and the magnitude is not arbitrary: the switch commits
    // at `_kDragCommitThreshold = 0.7` of `_kTrackWidth = 51`, so roughly 36pt
    // must arrive as drag UPDATES — and the recogniser eats the first ~18pt as
    // touch slop. 50pt of travel sits just under the line and reads as a
    // failure of the fix rather than of the arithmetic.
    for (var i = 0; i < 6; i++) {
      await gesture.moveBy(const Offset(12, 0));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await gesture.up();
    await tester.pumpAndSettle();

    expect(last, isTrue, reason: 'the drag never reached the switch');
  });

  testWidgets('a disabled switch ignores the band too', (tester) async {
    // The redirect runs whether or not the switch accepts input, so the
    // disabled control has to swallow the band press without toggling or
    // throwing.
    await tester.pumpWidget(
      host(child: const KalloSwitch(value: true, onChanged: null)),
    );
    await tester.pumpAndSettle();

    final rect = targetOf(tester);
    await tester.tapAt(Offset(rect.center.dx, rect.top + 1));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('a tap elsewhere in the row does NOT reach the switch', (
    tester,
  ) async {
    // The production shape: the switch as the trailing child of a Row. This is
    // the regression a hand-written hitTest invites and the analyzer cannot
    // see. `RenderFlex` hands EVERY child the row-local position and relies on
    // the child to reject what is not its own (`defaultHitTestChildren`), and
    // trailing children are tested first — so a redirect that clamps without
    // first checking its own bounds takes a tap on the label and flips the
    // setting. Verified by probe before the guard existed: tapping the label
    // toggled the switch.
    var toggles = 0;
    await tester.pumpWidget(
      host(
        child: Row(
          children: [
            const Expanded(child: Text('Tự động chia sẻ')),
            KalloSwitch(value: false, onChanged: (_) => toggles++),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tự động chia sẻ'));
    await tester.pumpAndSettle();
    expect(toggles, 0, reason: 'the label tap leaked into the switch');

    // ...and the switch itself still works, so the guard did not simply kill
    // the target it was added to protect.
    final rect = targetOf(tester);
    await tester.tapAt(Offset(rect.center.dx, rect.top + 1));
    await tester.pumpAndSettle();
    expect(toggles, 1);
  });

  testWidgets('the 44pt floor survives an IntrinsicHeight parent', (
    tester,
  ) async {
    // `RenderShiftedBox` delegates all four intrinsics straight to the child,
    // and overriding computeDryLayout does not cover them: the wrapper reported
    // the switch's 39, the parent handed back a tight 39, and
    // `constraints.constrain` collapsed the target. A layout widget silently
    // undoing the floor is the same failure as never having had one.
    await tester.pumpWidget(
      host(
        child: IntrinsicHeight(
          child: Row(
            children: [
              const Text('x'),
              KalloSwitch(value: false, onChanged: (_) {}),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(targetOf(tester).height, greaterThanOrEqualTo(KalloIcons.hit));
  });

  testWidgets('semanticLabel names the control', (tester) async {
    await tester.pumpWidget(
      host(
        child: KalloSwitch(
          value: true,
          onChanged: (_) {},
          semanticLabel: 'Tự động chia sẻ với vòng kết nối',
        ),
      ),
    );

    expect(
      find.bySemanticsLabel('Tự động chia sẻ với vòng kết nối'),
      findsOneWidget,
    );
  });
}

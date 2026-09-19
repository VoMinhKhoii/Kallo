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

  testWidgets('the tap target clears the 44pt floor', (tester) async {
    // CupertinoSwitch renders at 59x39 — 5pt under the floor. Switch.adaptive
    // hid that behind Material's `padded` tap target (>=48); taking the
    // Cupertino widget directly gives that up. Nothing caught the regression
    // when this file only asserted colour and semantics, so it asserts size
    // now. Its sibling commit spends a whole ConstrainedBox reaching 44 on the
    // cheat chips — the same floor has to hold here.
    await tester.pumpWidget(
      host(child: KalloSwitch(value: true, onChanged: (_) {})),
    );
    await tester.pumpAndSettle();

    final target = find.ancestor(
      of: find.byType(CupertinoSwitch),
      matching: find.byType(ConstrainedBox),
    );
    expect(
      tester.getSize(target.first).height,
      greaterThanOrEqualTo(KalloIcons.hit),
    );
    // And the control itself must NOT have grown to get there.
    expect(tester.getSize(find.byType(CupertinoSwitch)).height, lessThan(44));
  });

  testWidgets('a tap in the 44pt band toggles, and only once', (tester) async {
    // The other half of the floor, which the size assertion above did NOT
    // cover: `ConstrainedBox` and `Center` lay out to 44 but claim no hits, so
    // before the GestureDetector a finger in the 2.5pt band above the track
    // fell through to nothing. Tapping 1pt from the top edge is inside the
    // target and outside the 39pt switch — the exact band that was dead.
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

    final target =
        find
            .ancestor(
              of: find.byType(CupertinoSwitch),
              matching: find.byType(ConstrainedBox),
            )
            .first;
    final rect = tester.getRect(target);
    expect(
      rect.height - tester.getSize(find.byType(CupertinoSwitch)).height,
      greaterThan(2),
      reason: 'there has to BE a band for this test to mean anything',
    );

    await tester.tap(target, warnIfMissed: false);
    await tester.tapAt(Offset(rect.center.dx, rect.top + 1));
    await tester.pumpAndSettle();

    // Two taps, two toggles — not three or four. A tap that lands on the
    // switch must be claimed by the switch alone: both recognisers enter the
    // arena and the deeper one wins the sweep, so this detector is cancelled
    // rather than firing alongside it.
    expect(toggles, 2);
    expect(last, isTrue);
  });

  testWidgets('a disabled switch ignores the band too', (tester) async {
    // `onTap: null` rather than a forwarded call that dereferences a null
    // callback — the band must be inert, not crash.
    await tester.pumpWidget(
      host(child: const KalloSwitch(value: true, onChanged: null)),
    );
    await tester.pumpAndSettle();

    final rect = tester.getRect(
      find
          .ancestor(
            of: find.byType(CupertinoSwitch),
            matching: find.byType(ConstrainedBox),
          )
          .first,
    );
    await tester.tapAt(Offset(rect.center.dx, rect.top + 1));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
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

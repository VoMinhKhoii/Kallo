import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/form/kallo_switch.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

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

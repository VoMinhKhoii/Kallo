import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/form/kallo_switch.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

/// [KalloSwitch] exists because of one piece of Flutter behaviour, and these
/// tests pin it: on iOS/macOS `_SwitchThemeAdaptation.adapt()` discards
/// `ThemeData.switchTheme` outright, so the checked track colour has to be set
/// on the widget itself. If Flutter ever changes that, the third test fails and
/// KalloSwitch can collapse back into the theme.
void main() {
  Widget host({required ThemeData theme, required Widget child}) =>
      MaterialApp(theme: theme, home: Scaffold(body: Center(child: child)));

  RenderObject trackOf(WidgetTester tester) =>
      tester.renderObject(find.byType(Switch));

  for (final platform in [TargetPlatform.iOS, TargetPlatform.android]) {
    testWidgets('checked track is umber on $platform', (tester) async {
      await tester.pumpWidget(
        host(
          theme: ThemeData(platform: platform),
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
      host(
        theme: ThemeData(platform: TargetPlatform.iOS),
        child: KalloSwitch(value: false, onChanged: (_) {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(trackOf(tester), isNot(paints..rrect(color: KalloColors.btn)));
  });

  testWidgets('ThemeData.switchTheme alone would NOT colour the track on iOS', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        theme: ThemeData(
          platform: TargetPlatform.iOS,
          switchTheme: SwitchThemeData(
            trackColor: WidgetStateProperty.all(KalloColors.btn),
          ),
        ),
        // A bare adaptive switch — no widget-level override.
        child: Switch.adaptive(value: true, onChanged: (_) {}),
      ),
    );
    await tester.pumpAndSettle();

    expect(trackOf(tester), isNot(paints..rrect(color: KalloColors.btn)));
  });

  testWidgets('semanticLabel names the control', (tester) async {
    await tester.pumpWidget(
      host(
        theme: ThemeData(platform: TargetPlatform.iOS),
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
